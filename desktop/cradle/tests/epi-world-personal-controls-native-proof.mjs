/** Mandatory continuation gate in the original real whole driver. Controls
 * are ordinary UI operations; all native packets are genuine captured replies.
 * A closed quiet transaction proves native state/CAS only. Later ordinary
 * cosmic entry must prove complete 4096-sample production/GPU reception.
 * Original nine-driver positive/live-zero, Return, departure, restart and
 * scene_axes gates remain required and unchanged. No installed/audio/H claim. */
import assert from 'node:assert/strict';
import {axisPrediction,predictAllTargets,torusReceiving} from './epi-scene-axis-native-proof.mjs';
const copy=v=>structuredClone(v);
const host=row=>row.request?.request?.request;
const uint=v=>{assert.match(v,/^(0|[1-9][0-9]*)$/);return BigInt(v);};
// Actual raw packets remain retained by the original parent. JSON storage
// represents only signed zero differently; no other number/key is masked.
const stored=v=>{if(typeof v==='number'){assert.ok(Number.isFinite(v));return Object.is(v,-0)?0:v;}if(Array.isArray(v))return v.map(stored);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,stored(x)]));assert.notEqual(v,undefined);return v;};
async function witness(test,ms=20000){const end=Date.now()+ms;while(!test()){if(Date.now()>=end)throw Error('The actual personal-control native witness did not complete.');await new Promise(r=>setTimeout(r,10));}}
function selectedScene(s){const scene=s.document.scenes[s.state.sceneIndex];assert.ok(scene);return scene;}
function sourceReading(rows,lease,field){const found=rows.filter(r=>r.lease===lease&&r.field.generation===field.generation&&r.field.samples_elapsed===field.samples_elapsed).at(-1);assert.ok(found,'Fresh actual native Inspect is required');return found;}
function conservePersonal(before,after,label){
 assert.equal(selectedScene(after).id,selectedScene(before).id,label+': same presented personal Scene');
 assert.deepEqual(selectedScene(after),selectedScene(before),label+': complete authored personal material remains exact');
 for(const key of ['selected','sceneIndex','sceneElapsed','camera','fieldPaused','scenePlaying','journeyPlaying'])assert.deepEqual(after.state[key],before.state[key],label+': '+key);
 assert.equal(after.state.fieldPaused,true);assert.equal(after.state.scenePlaying,false);assert.equal(after.state.journeyPlaying,false);
 assert.deepEqual(after.current,before.current,label+': entire actual protected person/current body is conserved');
 assert.deepEqual(after.record.world,before.record.world,label+': complete original occasion remains exact');
 for(const key of ['person_ref','nara_ref','identity_source','identity_input_revision','source_basis','receiving'])assert.deepEqual(after.record[key],before.record[key],label+': '+key);
 for(const key of ['positions','velocities','targets','partitions','steps','simTime','seeds','bakes','particleCount','localizedResonance'])assert.deepEqual(after.rendered[key],before.rendered[key],label+': actual resident '+key);
 assert.deepEqual(after.telemetry.config,before.telemetry.config,label+': actual personal receiving configuration is conserved');
 assert.equal(after.native.lease,null);assert.equal(after.native.source,null);assert.equal(after.native.domain,null);assert.equal(after.native.status,'manual');
 assert.equal(after.native.lifetime.admission_pending,false);assert.equal(after.native.lifetime.close_pending,false);assert.equal(after.native.lifetime.operation_pending,0);assert.equal(after.native.lifetime.close_error,null);
}
function conserveDocument(before,after,record,actualReadback,label){
 assert.equal(after.expression_ref,before.expression_ref);assert.equal(after.revision,before.revision+1,label+': one actual native CAS successor');
 const a=copy(before),b=copy(after);a.revision=b.revision;
 const process=actualReadback.form_process,glyph=process.hexagram_glyph||process.triplet;
 assert.ok(glyph);assert.equal(process.process_subject_ref,record.world.current_form.process_subject_ref);
 for(const suffix of ['current-form','current-form-hinge']){
  const ref=record.world.instance_ref+':entity:world-'+suffix,old=a.entities[ref],next=b.entities[ref];assert.ok(old?.subject&&next?.subject);
  assert.deepEqual(next.subject.readings,[process.current_reading,...(process.source_refs??[]),...old.subject.readings.filter(r=>!r.ref.startsWith('ql:m-coordinate:'))],label+': exact current form source readings');
  old.subject.readings=copy(next.subject.readings);
  if(suffix==='current-form'){assert.deepEqual(next.parameters.glyph,{value:glyph,automation:null});old.parameters.glyph=copy(next.parameters.glyph);}
  const changed=JSON.stringify({...old,revision:0})!==JSON.stringify({...before.entities[ref],revision:0});
  assert.equal(next.revision,changed?after.revision:before.entities[ref].revision,label+': only actual changed entities advance revision');old.revision=next.revision;
 }
 const ca=a.scenes.find(s=>s.scene_ref===record.receiving.scene_ref),cb=b.scenes.find(s=>s.scene_ref===record.receiving.scene_ref);assert.ok(ca?.presentation?.scene&&cb?.presentation?.scene);
 assert.equal(cb.revision,after.revision);ca.revision=cb.revision;
 const held=cb.presentation.scene.epiWorld;assert.deepEqual(held.native_readback,stored(actualReadback));assert.deepEqual(held.continuation_start,stored(actualReadback.continuation_start));
 const oldRecord=copy(ca.presentation.scene.epiWorld),heldMask=copy(held);
 for(const key of ['native_readback','continuation_start','current_material_policy']){delete oldRecord[key];delete heldMask[key];}
 assert.deepEqual(heldMask,oldRecord,label+': whole world outside native continuation/material remains exact');
 ca.presentation.scene.epiWorld=copy(held);
 for(const presentationKey of ['scene','saved']){
  const x=ca.presentation[presentationKey],y=cb.presentation[presentationKey];assert.ok(x&&y,label+': actual source-authored saved material remains present');
  const form=x.entities.find(e=>e.id===record.world.instance_ref+':entity:world-current-form'),actual=y.entities.find(e=>e.id===form?.id);assert.ok(form&&actual);
  assert.equal(actual.text,glyph);assert.ok(actual.sequence.steps.length&&actual.sequence.steps.every(step=>step.text===glyph));
  form.text=glyph;for(const step of form.sequence.steps)step.text=glyph;
  // saved is the native complete authored snapshot; its Epi carrier, if present,
  // has the same exact acknowledged continuation as the current material.
  if(Object.prototype.hasOwnProperty.call(x,'epiWorld')){assert.deepEqual(y.epiWorld,held);x.epiWorld=copy(held);}
 }
 assert.deepEqual(b,a,label+': entire typed Document conserved outside explicitly proven native form/material changes');
}
export async function runPersonalControlContinuationGate({page,frame,world,snapshot,action,sceneNavigate,nativeComposes,nativeFrames,nativeInspections,nativeClosures,nativeDocument,savedFile,artifact,check,requirePersonalDrivers,clickActualBody,exposeNativePanel,op}){
 // Same-process file opening retains the already consumed protected current.
 // Only this genuine native Read supplies a fresh Document-revision envelope;
 // its complete context/body and all remaining members must match that consumer.
 async function currentReadback(document,record,consumed,label){
  const fresh=(await op({op:'nara_current',project:'',request:{operation:'read',binding:{operation:'context',role:'nara',source_ref:record.identity_source.source_ref,expected_revision:record.identity_source.revision,person_ref:record.person_ref,nara_ref:record.nara_ref,expression_ref:document.expression_ref}}})).data;
  assert.equal(fresh.schema,'oi.nara-personal-current-context/v1');assert.equal(fresh.status,'available');assert.equal(fresh.private,true);assert.equal(fresh.public_export,false);
  assert.equal(fresh.nara_ref,record.nara_ref);assert.equal(fresh.expression_ref,document.expression_ref);assert.equal(fresh.expression_revision,document.revision);
  assert.equal(fresh.context.event_ref,record.world.event_ref);assert.equal(fresh.reading.transit.sky.snapshot_ref,record.world.snapshot_ref);
  const expected=copy(consumed);expected.expression_revision=document.revision;
  assert.deepEqual(fresh,expected,label+': complete genuine native current equals the actual nine-driver consumer apart from its freshly read Document-revision envelope');
  artifact(label+'-fresh-current-read.json',{schema:fresh.schema,status:fresh.status,expression_ref:fresh.expression_ref,expression_revision:fresh.expression_revision,nara_ref:fresh.nara_ref,reading_ref:fresh.context.reading_ref,reading_revision:fresh.context.reading_revision,event_ref:fresh.context.event_ref,private:fresh.private,public_export:fresh.public_export,complete_native_read_equal_to_consumer:true,consumer_envelope_expression_revision:consumed.expression_revision,scope:'Actual native Read header and complete private-context/body equality; no new pin, restore, private state or scene adoption'});
 }
 assert.ok(world.working.file?.location?.path,'The original completed A encounter supplies the same actual saved-file route');
 assert.equal(await frame.evaluate(path=>window.__FIELD_STUDIES__.openNativeFile(path),world.working.file.location.path),true);
 await frame.waitForFunction(p=>window.__FIELD_STUDIES__.epiWorld()?.person_ref===p&&!window.__FIELD_STUDIES__.nativeWorking()?.pending,world.record.person_ref,{timeout:90000});
 const arrival=await snapshot('personal-controls-original-basis'),record=arrival.record,personal=record.world.instance_ref+':scene:personal';
 await sceneNavigate(personal);await frame.locator('[data-epi-body]').selectOption(record.receiving.personal.centre_entity_refs[3]);
 await frame.waitForFunction(ref=>window.__FIELD_STUDIES__.getState().selected.includes(ref),record.receiving.personal.centre_entity_refs[3]);
 if(!await frame.locator('#timeline-panel').isVisible())await frame.locator('#scene-picker').click();
 const scrub=frame.locator('#expression-playhead');await scrub.focus();await scrub.press('ArrowRight');
 await frame.waitForFunction(()=>{const s=window.__FIELD_STUDIES__.getState();return s.sceneElapsed>0&&s.fieldPaused&&!s.scenePlaying;});
 await action('save');
 const atRest=await snapshot('personal-controls-at-rest-before-controls',true),typedBefore=await nativeDocument(record.world.instance_ref);
 assert.equal(selectedScene(atRest).id,personal);assert.ok(atRest.state.sceneElapsed>0);assert.deepEqual(atRest.state.selected,[record.receiving.personal.centre_entity_refs[3]]);
 assert.equal(typedBefore.selection.scene_ref,personal);assert.equal(typedBefore.selection.entity_ref,record.receiving.personal.centre_entity_refs[3]);
 assert.equal(typedBefore.entities[record.receiving.personal.locus_entity_ref].subject.subject_ref,'ql:m-coordinate:bimba:M4.4.4.4');
 requirePersonalDrivers(atRest,'Personal controls actual at-rest native nine-driver consumer');
 await frame.evaluate(()=>{const e=window.OI_DEBUG_ENGINE;window.__EPI_PERSONAL_CONTROL_ENGINE__={engine:e.engine,renderer:e.engine.renderer};});
 let prior=atRest,priorDocument=typedBefore;const trials=[];
 const commands=[{operation:'set-damping',per_second:0.5},{operation:'set-axis',axis:0,phase:{turns:'2',half_degrees:97}},{operation:'set-axis',axis:1,phase:{turns:'-1',half_degrees:211}},{operation:'m1-advance',ticks:1}];
 for(const command of commands){
  const label='personal-controls-'+command.operation+(command.axis??''),start=nativeComposes.length,first=nativeFrames.length,closed=nativeClosures.length;
  if(command.operation==='set-damping'){await frame.locator('[data-epi-damping]').fill(String(command.per_second));await action('set-damping');}
  else if(command.operation==='set-axis'){
   await frame.locator(`[data-epi-axis-turns="${command.axis}"]`).fill(command.phase.turns);await frame.locator(`[data-epi-axis-half="${command.axis}"]`).fill(String(command.phase.half_degrees));
   const button=frame.locator(`[data-epi="set-axis"][data-epi-axis="${command.axis}"]`);await button.click();
   await frame.waitForFunction(()=>!document.querySelector('.epi-world-entrance [role="status"]')?.textContent?.includes('Receiving the native operation'),null,{timeout:180000});
   assert.deepEqual((await frame.locator('.epi-world-entrance [role="alert"]').allTextContents()).filter(Boolean),[]);
  }else await action('step');
  await witness(()=>nativeClosures.length>closed);
  const created=nativeComposes.slice(start);assert.equal(created.length,1,'One real quiet native Compose, no receiving workaround or retry');const opened=created[0];
  assert.deepEqual(opened.request.request.request.world.start,prior.record.continuation_start,'Same complete native continuation enters the real constructor');
  assert.deepEqual(opened.request.request.request.world.material,prior.record.current_material_policy?.material??record.world.binding.host.material);
  const rows=nativeFrames.slice(first).filter(row=>row.lease===opened.lease),changes=rows.filter(row=>host(row)?.command?.operation===command.operation);assert.equal(changes.length,1);
  const actual=changes[0],request=host(actual);assert.deepEqual(request.command,command);assert.equal(request.instance_ref,record.world.instance_ref);assert.equal(request.event_ref,record.world.event_ref);assert.equal(request.subject_ref,record.person_ref);
  const original=rows.find(row=>row.field.generation===request.expected_generation&&row.field.samples_elapsed===request.expected_samples_elapsed);assert.ok(original);
  const beforeSources=sourceReading(nativeInspections,opened.lease,original.field),afterSources=sourceReading(nativeInspections,opened.lease,actual.field);
  assert.equal(actual.field.samples_elapsed,original.field.samples_elapsed);assert.deepEqual(actual.field.audio,[]);assert.equal(actual.field.targets.length,4096);
  assert.ok(rows.filter(r=>host(r)).every(r=>['inspect','influence',command.operation].includes(host(r).command.operation)),'No worker Advance, audio pump, projection or hidden physics in a quiet transaction');
  const closure=nativeClosures.slice(closed).filter(row=>row.request.request.lease===opened.lease);assert.equal(closure.length,1);assert.deepEqual(closure[0].response,{schema:'oi.native-expression-closed/v1',lease:opened.lease,closed:true});
  if(command.operation==='set-axis'){
   const predicted=axisPrediction(original.field,command.axis,command.phase);assert.deepEqual(actual.field.clock,predicted);
   assert.deepEqual(actual.field.targets,predictAllTargets(beforeSources.sources.original_field.samples,original.field,predicted),'Independent all4096 axis prediction');
   for(const key of ['amplitudes_metres','m2_identity','shape_ref','samples_elapsed'])assert.deepEqual(actual.field[key],original.field[key]);
  }else if(command.operation==='set-damping'){
   assert.equal(uint(actual.field.generation),uint(original.field.generation)+1n);
   for(const key of ['clock','amplitudes_metres','targets','samples_elapsed','shape_ref'])assert.deepEqual(actual.field[key],original.field[key]);
   assert.ok(afterSources.sources.current.m2.resonator.modes.every(mode=>mode.damping_per_second===0.5));
  }else{
   const before=prior.record.native_readback??prior.record.world.native_readback,after=afterSources.sources.current;
   assert.equal(after.m1.config.tick12,(before.m1_clock.tick12+1)%12);
   const fresh=(await snapshot(label+'-source-readback')).record.native_readback;
   assert.equal(fresh.m3_clock.degree360,(before.m3_clock.degree360+30)%360);assert.deepEqual(fresh.continuous_clock.lensing,before.continuous_clock.lensing);
   assert.equal(fresh.continuous_clock.inscription.half_degrees,fresh.m3_clock.degree360*2,'M1 aligns ClockA to the actual source clock, not a stale independent phase');
  }
  const after=await snapshot(label+'-selected-personal-receiver',true),typed=await nativeDocument(record.world.instance_ref);
  conservePersonal(prior,after,label);requirePersonalDrivers(after,label+' native nine-driver consumer');
  assert.equal(await frame.evaluate(()=>{const e=window.OI_DEBUG_ENGINE,s=window.__EPI_PERSONAL_CONTROL_ENGINE__;return e.engine===s.engine&&e.engine.renderer===s.renderer;}),true,'The actual personal engine/renderer lifetime is never replaced');
  assert.equal(await frame.evaluate(()=>window.__FIELD_STUDIES__.nativeTargets()),null,'Quiet native state has no borrowed personal GPU lease');
  const q=after.native.quiet_control;assert.equal(q.closed,true);assert.equal(q.lease,opened.lease);assert.equal(q.request_id,request.request_id);assert.equal(q.generation,actual.field.generation);assert.equal(q.samples_elapsed,actual.field.samples_elapsed);
  assert.deepEqual(after.record.native_readback.continuous_clock_native,actual.field.clock);assert.deepEqual(after.record.continuation_start,after.record.native_readback.continuation_start);
  conserveDocument(priorDocument,typed,record,after.record.native_readback,label);
  assert.deepEqual(typed.selection,priorDocument.selection);
  trials.push({command,request,lease:opened.lease,closed:closure[0].response,actual_field:actual.field,actual_fresh_sources:afterSources.sources,document_revision:typed.revision,personal_scene:personal,selected:after.state.selected,scene_elapsed:after.state.sceneElapsed,standing:'actual native determinant and full CAS acknowledged; personal body conserved; cosmic GPU receiving remains required below'});
  prior=after;priorDocument=typed;
 }
 // Delay one genuine fresh native Inspect ACK, move to another actual rendered
 // centre, then release the EXACT real reply. No synthetic response or fake ACK.
 let held=null,release=null,armed=true;const first=nativeFrames.length,start=nativeComposes.length,closed=nativeClosures.length;
 const routePattern='**/op';
 const route=async r=>{const sent=r.request().postDataJSON();if(armed&&sent?.op==='native_expression'&&sent.request?.operation==='exchange'&&sent.request.request?.command?.operation==='inspect'&&nativeFrames.slice(first).some(row=>row.lease===sent.request.lease&&host(row)?.command?.operation==='set-damping')){
  armed=false;const actual=await r.fetch();const raw=await actual.text();const body=JSON.parse(raw);assert.equal(actual.status(),200);assert.equal(body.ok,true);held={request:sent,response:body,raw};
  await new Promise(resolve=>release=resolve);await r.fulfill({response:actual});
 }else await r.continue();};
 await page.route(routePattern,route);
 let holdReleased=false;
 try{
  await frame.locator('[data-epi-damping]').fill('0.75');await frame.locator('[data-epi="set-damping"]').click();await witness(()=>held!==null,10000);
  await clickActualBody(record.receiving.personal.centre_entity_refs[4]);release();holdReleased=true;
  await frame.waitForFunction(()=>!document.querySelector('.epi-world-entrance [role="status"]')?.textContent?.includes('Receiving the native operation'),null,{timeout:180000});
  const text=(await frame.locator('.epi-world-entrance [role="alert"]').allTextContents()).join(' ');assert.match(text,/changed|continuation|selected|quiet control/);
  await witness(()=>nativeClosures.length>closed);
  const refused=await snapshot('personal-controls-changed-selection-refused',true);assert.equal(refused.state.sceneIndex,prior.state.sceneIndex);assert.equal(refused.state.sceneElapsed,prior.state.sceneElapsed);assert.deepEqual(refused.current,prior.current);
  assert.deepEqual(refused.record,prior.record,'An actually committed native determinant on the superseded quiet owner is closed, not adopted into the selected personal world');
  assert.deepEqual(refused.state.selected,[record.receiving.personal.centre_entity_refs[4]]);assert.equal(refused.native.lease,null);assert.equal(refused.native.status,'manual');
  const created=nativeComposes.slice(start);assert.equal(created.length,1);assert.equal(nativeClosures.slice(closed).filter(row=>row.response.lease===created[0].lease&&row.response.closed===true).length,1);
  artifact('personal-controls-held-original-inspect-and-selection-refusal.json',{actual_held:held,closed:created[0].lease,selected:refused.state.selected,world_continuation_not_adopted:true});
 }finally{if(release&&!holdReleased)release();await page.unroute(routePattern,route);}
 await frame.locator('[data-epi-body]').selectOption(record.receiving.personal.centre_entity_refs[3]);await action('save');const saved=await snapshot('personal-controls-saved-full-file',true),doc=await nativeDocument(record.world.instance_ref);
 assert.deepEqual(await savedFile(saved.working,'personal-controls-saved'),doc);assert.deepEqual(doc.selection,typedBefore.selection);
 const retained=copy(saved.record),current=copy(saved.current);assert.equal(await frame.evaluate(path=>window.__FIELD_STUDIES__.openNativeFile(path),saved.working.file.location.path),true);
 await frame.waitForFunction(p=>window.__FIELD_STUDIES__.epiWorld()?.person_ref===p&&!window.__FIELD_STUDIES__.nativeWorking()?.pending,record.person_ref,{timeout:90000});
 const reopened=await snapshot('personal-controls-real-file-reopen',true);assert.equal(selectedScene(reopened).id,personal);assert.deepEqual(reopened.state.selected,saved.state.selected);assert.equal(reopened.state.sceneElapsed,saved.state.sceneElapsed);assert.deepEqual(reopened.record,retained);assert.deepEqual(reopened.current,current,'Same-process reopening retains the complete already consumed protected current');requirePersonalDrivers(reopened,'Personal control file continuation');await currentReadback(doc,retained,reopened.current,'personal-controls-real-file-reopen');
 // Deliberate ordinary cosmic entry, then an actual ordinary axis operation
 // opens the saved native continuation and admits the complete production torus.
 const receptionCurrent=copy(reopened.current),receptionStart=nativeComposes.length;await sceneNavigate(record.receiving.scene_ref);
 await frame.locator('[data-epi-axis-turns="1"]').fill(retained.native_readback.continuous_clock.lensing.turns);await frame.locator('[data-epi-axis-half="1"]').fill(String(retained.native_readback.continuous_clock.lensing.half_degrees));
 await frame.locator('[data-epi="set-axis"][data-epi-axis="1"]').click();await frame.waitForFunction(()=>!document.querySelector('.epi-world-entrance [role="status"]')?.textContent?.includes('Receiving the native operation'),null,{timeout:180000});
 assert.deepEqual((await frame.locator('.epi-world-entrance [role="alert"]').allTextContents()).filter(Boolean),[]);
 await exposeNativePanel();const panel=frame.locator('.native-field-panel');await panel.locator('[data-ni="hold"]').click();
 await frame.waitForFunction(()=>window.__FIELD_STUDIES__.native()?.status==='held');
 const depth=panel.locator('[data-ni-depth]');if(!await depth.evaluate(e=>e.open))await depth.locator(':scope > summary').click();
 const operations=depth.locator('details').filter({has:frame.getByText('Native operation and sources',{exact:true})});if(!await operations.evaluate(e=>e.open))await operations.locator(':scope > summary').click();
 await panel.locator('[data-native="inspect"]').click();
 await frame.waitForFunction(()=>{const n=window.__FIELD_STUDIES__.native();return document.querySelector('.native-field-panel')?.getAttribute('aria-busy')==='false'&&n?.status==='held'&&n.native?.available===true&&n.native.acknowledged?.generation===n.native.presented?.generation&&n.native.acknowledged?.samples_elapsed===n.native.presented?.samples_elapsed;});
 const received=await torusReceiving({frame,snapshot,nativeFrames,artifact,record,label:'personal-controls-deliberate-complete-cosmic-reception'});
 const actualComposes=nativeComposes.slice(receptionStart);assert.equal(actualComposes.length,1);const admitted=actualComposes[0];
 assert.deepEqual(admitted.request.request.request.world.start,retained.continuation_start);assert.deepEqual(admitted.request.request.request.world.material,retained.current_material_policy.material);
 assert.deepEqual(admitted.source.world.native_readback.continuous_clock,retained.native_readback.continuous_clock);assert.deepEqual(admitted.source.world.native_readback.m1_clock,retained.native_readback.m1_clock);assert.deepEqual(admitted.source.world.native_readback.m3_clock,retained.native_readback.m3_clock);
 assert.equal(received.s.native.lease,admitted.lease);assert.deepEqual(received.s.native.instrument.influence.material,retained.current_material_policy.material);assert.deepEqual(received.s.current,receptionCurrent);assert.deepEqual(received.s.record.world,retained.world);
 await sceneNavigate(personal);const returned=await snapshot('personal-controls-ordinary-personal-return',true);assert.deepEqual(returned.current,receptionCurrent);requirePersonalDrivers(returned,'Personal controls ordinary return');assert.equal(returned.native.lease,null);
 // This deliberate native-only commit follows the positive Save/reopen and
 // complete cosmic receiving proofs. Its stale-recipient witness is retained
 // before a separate explicit ordinary Follow and Save chooses its successor.
 // The final commit/adoption seam is separate from Inspect. Hold the exact
 // genuine native edit ACK AFTER commit, change the actual rendered recipient,
 // then release it. The owner commit remains true; the old local recipient is
 // not adopted over the newer selection/private intent.
 await frame.locator('[data-epi-body]').selectOption(record.receiving.personal.centre_entity_refs[3]);await action('save');
 const casBefore=await snapshot('personal-controls-before-held-native-edit',true),casDocument=await nativeDocument(record.world.instance_ref);
 let refusedCommit=null,refusedLocal=null,refusedNative=null;
 let heldEdit=null,releaseEdit=null,editArmed=true,editReleased=false;const editClosed=nativeClosures.length,editStart=nativeComposes.length,editFirst=nativeFrames.length;
 const editRoute=async r=>{const sent=r.request().postDataJSON();if(editArmed&&sent?.op==='expression'&&sent.request?.operation==='edit'&&sent.request.changes?.some(change=>change.change==='scene_material_set'&&change.presentation?.scene?.epiWorld?.current_material_policy?.material?.damping_per_second===0.8)){
  editArmed=false;const actual=await r.fetch(),raw=await actual.text(),body=JSON.parse(raw);assert.equal(actual.status(),200);assert.equal(body.ok,true);assert.equal(body.outcome?.data?.document?.expression_ref,record.world.instance_ref);heldEdit={request:sent,response:body,raw};
  await new Promise(resolve=>releaseEdit=resolve);await r.fulfill({response:actual});
 }else await r.continue();};
 await page.route(routePattern,editRoute);
 try{
  await frame.locator('[data-epi-damping]').fill('0.8');await frame.locator('[data-epi="set-damping"]').click();await witness(()=>heldEdit!==null,10000);
  await clickActualBody(record.receiving.personal.centre_entity_refs[4]);releaseEdit();editReleased=true;
  await frame.waitForFunction(()=>!document.querySelector('.epi-world-entrance [role="status"]')?.textContent?.includes('Receiving the native operation'),null,{timeout:180000});
  const text=(await frame.locator('.epi-world-entrance [role="alert"]').allTextContents()).join(' ');assert.match(text,/saved natively.*changed selected recipient/);
  const committed=heldEdit.response.outcome.data.document,carrier=committed.scenes.find(scene=>scene.scene_ref===record.receiving.scene_ref).presentation.scene.epiWorld;
  // Epi completion and queued focus acknowledgement are distinct. Qualify
  // the genuine focus ACK before requiring an idle, non-pending local snapshot.
  await frame.waitForFunction(({revision,ref})=>{const w=window.__FIELD_STUDIES__.nativeWorking();return !w?.busy&&!w?.pending&&w?.revision===revision&&window.__FIELD_STUDIES__.getState().selected.includes(ref);},{revision:committed.revision+1,ref:record.receiving.personal.centre_entity_refs[4]});
  const local=await snapshot('personal-controls-native-commit-local-adoption-refused',true);
  assert.equal(selectedScene(local).id,personal);assert.equal(local.state.sceneElapsed,casBefore.state.sceneElapsed);assert.deepEqual(local.state.selected,[record.receiving.personal.centre_entity_refs[4]]);assert.deepEqual(local.current,casBefore.current);
  assert.deepEqual(local.record,casBefore.record,'The already committed native successor is not silently loaded over the changed recipient');
  assert.equal(local.native.lease,null);assert.equal(local.native.status,'manual');
  // The queued ordinary focus lawfully owns its own status after this refusal.
  // A sticky generic workspace failed flag is neither required nor sufficient.
  assert.equal(local.working.pending,null);
  assert.equal(carrier.current_material_policy.material.damping_per_second,0.8);conserveDocument(casDocument,committed,record,carrier.native_readback,'Actual held native commit');
  assert.equal(committed.selection.scene_ref,personal);assert.equal(committed.selection.entity_ref,record.receiving.personal.centre_entity_refs[3]);
  const fresh=await nativeDocument(record.world.instance_ref),freshCarrier=fresh.scenes.find(scene=>scene.scene_ref===record.receiving.scene_ref).presentation.scene.epiWorld;assert.deepEqual(freshCarrier,carrier,'The actual native owner retains its commit; no rollback or synthetic refusal');
  const expectedFocus=copy(committed);expectedFocus.revision=committed.revision+1;expectedFocus.selection={scene_ref:personal,entity_ref:record.receiving.personal.centre_entity_refs[4]};
  assert.deepEqual(fresh,expectedFocus,'The queued ordinary focus advances only its lawful native revision and exact selection; the full committed material/source/private basis remains exact');
  refusedCommit={document_revision:committed.revision,lawful_focus_revision:fresh.revision,material_damping_per_second:0.8,saved_to_prior_file:false,local_carrier_adopted:false};
  refusedLocal=local;refusedNative=fresh;
  const created=nativeComposes.slice(editStart);assert.equal(created.length,1);await witness(()=>nativeClosures.slice(editClosed).some(row=>row.response.lease===created[0].lease));assert.equal(nativeClosures.slice(editClosed).filter(row=>row.response.lease===created[0].lease&&row.response.closed===true).length,1);
  const actual=nativeFrames.slice(editFirst).filter(row=>row.lease===created[0].lease&&host(row)?.command?.operation==='set-damping');assert.equal(actual.length,1);assert.equal(host(actual[0]).command.per_second,0.8);assert.deepEqual(carrier.native_readback.continuous_clock_native,actual[0].field.clock);
  artifact('personal-controls-held-real-edit-ack-adoption-refusal.json',{actual_held:heldEdit,actual_native_owner:fresh,local_selected:local.state.selected,local_world_unchanged:true,native_commit_retained:true,stale_recipient_native_commit:refusedCommit,closed_lease:created[0].lease});
 }finally{if(releaseEdit&&!editReleased)releaseEdit();await page.unroute(routePattern,editRoute);}
 // The owner correctly refuses opening the earlier file over that newer
 // unsaved native head. Choose the actual existing host-command Follow route:
 // it retains the displaced draft under a separate recovery identity, inspects
 // the genuine native head, and adopts it only on this explicit choice.
 assert.ok(refusedCommit&&refusedLocal&&refusedNative);
 const recoveryBefore=(await op({op:'expression_recovery',request:{operation:'list',scope:'expressions',kind:'draft'}})).data;
 assert.equal(recoveryBefore.state,'listed');assert.ok(recoveryBefore.records.every(row=>!Object.prototype.hasOwnProperty.call(row,'value')),'Native recovery inventory remains metadata only');
 const prefix=refusedLocal.document.id.replace(/[^a-zA-Z0-9_.:-]/g,'-').slice(0,120)+'.unsaved-',priorDrafts=new Set(recoveryBefore.records.map(row=>row.id));
 await page.evaluate(ref=>{const frame=document.querySelector('#world');if(!(frame instanceof HTMLIFrameElement)||!frame.contentWindow)throw Error('The actual production host frame is absent');frame.contentWindow.postMessage({v:1,kind:'host-command',command:'open-expression',ref},'*');},record.world.instance_ref);
 await frame.waitForFunction(revision=>{const f=window.__FIELD_STUDIES__,w=f.nativeWorking();return !w?.busy&&!w?.pending&&!w?.failed&&w?.revision===revision&&f.epiWorld()?.current_material_policy?.material?.damping_per_second===0.8;},refusedNative.revision,{timeout:90000});
 const followed=await snapshot('personal-controls-explicit-host-followed-native-successor',true),followedDocument=await nativeDocument(record.world.instance_ref);
 assert.deepEqual(followedDocument,refusedNative,'The explicit ordinary Follow inspects/adopts the exact full native head without editing it');
 assert.deepEqual(followed.record,refusedNative.scenes.find(scene=>scene.scene_ref===record.receiving.scene_ref).presentation.scene.epiWorld);
 assert.equal(selectedScene(followed).id,personal);assert.deepEqual(followed.state.selected,[record.receiving.personal.centre_entity_refs[4]]);assert.deepEqual(followed.current,refusedLocal.current);requirePersonalDrivers(followed,'Explicit ordinary Follow retains the actual person/occasion and consumes all nine native drivers');
 assert.deepEqual(selectedScene(followed).entities.map(entity=>entity.id),selectedScene(refusedLocal).entities.map(entity=>entity.id),'All nine personal bodies, including seven centres, remain addressable');
 const recoveryAfter=(await op({op:'expression_recovery',request:{operation:'list',scope:'expressions',kind:'draft'}})).data;assert.equal(recoveryAfter.state,'listed');assert.ok(recoveryAfter.records.every(row=>!Object.prototype.hasOwnProperty.call(row,'value')));
 const preserved=recoveryAfter.records.filter(row=>row.id.startsWith(prefix)&&!priorDrafts.has(row.id));assert.equal(preserved.length,1,'One exact displaced unsaved draft must be retained separately before adoption');
 const retainedReply=(await op({op:'expression_recovery',request:{operation:'read',scope:'expressions',kind:'draft',id:preserved[0].id}})).data;assert.equal(retainedReply.state,'ready');assert.equal(retainedReply.record.id,preserved[0].id);assert.equal(retainedReply.record.revision,preserved[0].revision);
 const expectedDraft=copy(refusedLocal.document);expectedDraft.id=preserved[0].id;expectedDraft.name=(refusedLocal.document.name+' (unsaved)').slice(0,160);
 // validateJourney/cloned draft travels through the original native JSON wire:
 // retain its complete serialized value, including the actual omission of
 // undefined optional members and JSON signed-zero spelling. No body defaults.
 assert.deepEqual(retainedReply.record.value,JSON.parse(JSON.stringify(expectedDraft)),'Complete displaced authored material, sources, private receiving bindings and held metadata equal the genuine JSON draft wire; only the new recovery identity/name differ');
 artifact('personal-controls-explicit-follow-displaced-draft-retention.json',{native_head_revision:followedDocument.revision,displaced_draft_metadata:preserved[0],complete_displaced_draft_equal:true,original_negative:refusedCommit,standing:'Explicit ordinary ref-only host Follow; no forced same-reference debug Open, replacement Document or substituted ACK'});
 await action('save');const continuedSaved=await snapshot('personal-controls-followed-successor-actually-saved',true),continuedDocument=await nativeDocument(record.world.instance_ref);
 assert.deepEqual(continuedDocument,followedDocument,'Ordinary Save retains the exact chosen native successor and lawful selection');assert.deepEqual(await savedFile(continuedSaved.working,'personal-controls-chosen-successor-saved'),continuedDocument);
 const continuationCurrent=copy(continuedSaved.current),continuationRecord=copy(continuedSaved.record);
 assert.equal(await frame.evaluate(path=>window.__FIELD_STUDIES__.openNativeFile(path),continuedSaved.working.file.location.path),true);
 await frame.waitForFunction(revision=>{const f=window.__FIELD_STUDIES__,w=f.nativeWorking();return !w?.busy&&!w?.pending&&!w?.failed&&w?.revision===revision&&f.epiWorld()?.current_material_policy?.material?.damping_per_second===0.8;},continuedDocument.revision,{timeout:90000});
 const continuedReopen=await snapshot('personal-controls-chosen-native-successor-full-file-reopened',true);
 assert.deepEqual(await nativeDocument(record.world.instance_ref),continuedDocument);assert.deepEqual(continuedReopen.record,continuationRecord);assert.equal(selectedScene(continuedReopen).id,personal);assert.deepEqual(continuedReopen.state.selected,continuedSaved.state.selected);assert.equal(continuedReopen.state.sceneElapsed,continuedSaved.state.sceneElapsed);assert.deepEqual(continuedReopen.current,continuationCurrent,'Same-process chosen-file reopening retains the complete already consumed protected current');requirePersonalDrivers(continuedReopen,'Actual saved/reopened chosen successor consumes its complete native personal body');await currentReadback(continuedDocument,continuationRecord,continuedReopen.current,'personal-controls-chosen-native-successor-full-file-reopened');
 assert.deepEqual(await savedFile(continuedReopen.working,'personal-controls-chosen-successor-reopened'),continuedDocument,'The unchanged original D30 receives a genuinely current saved full Document, not an older file over a dirty owner');
 check(true,'Personal at-rest damping, both independent axes and M1 tick preserve exact selected body/elapsed/private current/native Document, fence a real in-flight selection, save/reopen, and later receive all4096 native cosmic samples');
 await frame.evaluate(()=>{delete window.__EPI_PERSONAL_CONTROL_ENGINE__;});
 const result={schema:'oi.epi-personal-control-continuation-native-proof/v1',passed:true,trials,held_selection_refused:true,held_native_commit_adoption_refused:true,native_commit_retained:true,saved_file:continuedReopen.working.file,saved_file_scope:'Exact native successor after explicit ordinary Follow, complete displaced-draft retention, actual Save and full file reopening',prior_positive_saved_file:saved.working.file,later_complete_cosmic_receiving:true,stale_recipient_native_commit:refusedCommit,explicit_follow_and_saved_successor:true,displaced_draft_metadata:preserved[0],scope:'Actual source-built whole browser/native owner/production GPU proof; software/hardware environment belongs to original runner. No installed, physical audio, complete remaining branches or H claim.'};artifact('personal-controls-native-proof.json',result);return result;
}
