#!/usr/bin/env node
/** Actual native Nara turn -> exact cited focus -> retained checkpoint return.
 * Uses production native dialogue and ExpressiveAct modules, real QL/AIKit and
 * Expression operations. No supplied model answer, constitution or checkpoint.
 * node tests/nara-expressive-act-native.mjs /absolute/controlled-config.json
 * Includes actual browser AudioContext playback to completion. Installed UI
 * interaction, microphone and audible-speaker evidence remain separate.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {closeControlledExpression} from './nara-native-cleanup.mjs';
const config=JSON.parse(await readFile(process.argv[2],'utf8'));
assert.match(config.bridge,/^http:\/\/127\.0\.0\.1:\d+$/);
assert.match(config.binding.person_ref,/^controlled:/);
assert.ok(config.world.includes('/Control/agents/now/clearings/')&&config.world.includes('/T/')&&config.world.endsWith('/world'));
const output=path.join(path.dirname(process.argv[2]),'nara-expressive-act-native');await mkdir(output,{recursive:true});
const sources={working_files:Object.fromEntries(await Promise.all(['kernel/src/nara_expressive_act.rs','kernel/src/lib.rs','src/nara/nativeExpressiveAct.ts','src/nara/nativeDialogue.ts'].map(async file=>[file,createHash('sha256').update(await readFile(file)).digest('hex')]))),
 native_cut:config.native_source_cut?JSON.parse(await readFile(config.native_source_cut,'utf8')):null};
const events=[],checks=[];
async function native(request){
 const response=await fetch(config.bridge+'/op',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(90000)});
 const result=await response.json();events.push({op:request.op,operation:request.request?.operation??request.request?.action,error:result.error??null});
 if(result.error)throw Error(result.error);assert.ok(result.outcome);return result.outcome.data;
}
const transport={kind:'bridge',url:config.bridge};
const expression_ref='expression:controlled-act-'+randomUUID();
const server=await createServer({configFile:false,root:process.cwd(),cacheDir:path.join(output,'vite-cache'),server:{middlewareMode:true},ssr:{noExternal:[]}});
let created=false,dialogue,voiceRef=null,browser,lastReview;
try{
 if(config.file_path){const {hostedCompositionFile}=await server.ssrLoadModule('/src/expressions/hostedComposition.ts');
  const opened=await hostedCompositionFile(transport,{operation:'open',path:config.file_path});
  assert.equal(opened.document.expression_ref,config.binding.expression_ref);
 }
 const source=await native({op:'expression',request:{operation:'inspect',expression_ref:config.binding.expression_ref}});
 const fork=await native({op:'expression',request:{operation:'fork',expression_ref:source.document.expression_ref,
  expected_revision:source.document.revision,new_expression_ref:expression_ref,actor:'agent:nara-native-verification'}});
 created=true;assert.ok(fork.document.selection.entity_ref,'The source must have an actual selected native entity');
 const identity=await native({op:'nara_identity',request:{operation:'open',source_ref:config.binding.source_ref}});
 const {selectCurrentIdentity,currentIdentity}=await server.ssrLoadModule('/src/nara/identity/current.ts');
 selectCurrentIdentity(identity.reading,identity.source);
 const {adoptCoordinateExpression}=await server.ssrLoadModule('/src/nara/coordinateExpression.ts');
 const coordinate=await native({op:'nara_coordinate',request:{coordinate_ref:'#4.1',face:'bimba'}});
 const document=await adoptCoordinateExpression(request=>native({op:'expression',request}),coordinate,fork.document,fork.document.selection.entity_ref);
 const {acquireNativeDialogue,currentTurnBasis,nativeTurnText,submitNativeTurn}=await server.ssrLoadModule('/src/nara/nativeDialogue.ts');
 dialogue=await acquireNativeDialogue(transport,config.project,currentIdentity(),expression_ref,'nara');
 let pinned;
 if(config.context_join){
  const request={operation:'context',...dialogue.binding,expected_revision:identity.source.revision};
  const absent=await native({op:'nara_current',project:config.project,request:{operation:'read',binding:request}});
  assert.equal(absent.status,'absent');
  pinned=await native({op:'nara_current',project:config.project,request:{operation:'pin',binding:request,sky_request:config.sky_request}});
  assert.equal(pinned.status,'available');assert.match(pinned.context.reading_ref,/^personal:nara-current:/);
  assert.equal(pinned.context.event_ref,pinned.reading.transit.sky.snapshot_ref);
  assert.equal(pinned.reading.private,true);assert.equal(pinned.reading.public_export,false);
  await assert.rejects(()=>native({op:'nara_current',project:config.project,request:{operation:'pin',binding:request,sky_request:config.sky_request,reading:pinned.reading}}),/unreadable|unknown field/);
  await assert.rejects(()=>native({op:'nara_current',project:config.project,request:{operation:'read',binding:{...request,expected_revision:identity.source.revision+':stale'}}}),/changed|revision/);
  const saved=await native({op:'nara_identity',request:{operation:'list'}});
  const otherSource=saved.profiles.find(row=>row.person_ref.startsWith('controlled:')&&row.person_ref!==identity.reading.person_ref);
  assert.ok(otherSource,'An independently saved controlled identity is required for private pin isolation');
  const other=await native({op:'nara_identity',request:{operation:'open',source_ref:otherSource.source_ref}});
  const otherBinding={...request,source_ref:other.source.source_ref,expected_revision:other.source.revision,
    person_ref:other.reading.person_ref,nara_ref:other.reading.nara_ref};
  const privateOther=await native({op:'nara_current',project:config.project,request:{operation:'read',binding:otherBinding}});
  assert.equal(privateOther.status,'absent');assert.equal(privateOther.reading,null);
  assert.equal(JSON.stringify(privateOther).includes(pinned.context.reading_ref),false);
  await assert.rejects(()=>native({op:'nara_current',project:config.project,request:{operation:'read',binding:{...request,nara_ref:other.reading.nara_ref}}}),/changed|identity|basis/);
  checks.push('Native current pin computes its own real dated snapshot; supplied reading bypass is refused');
  checks.push('Stale or mismatched saved identity cannot read the pin; a different actual saved Nara has no inherited private reading');
 }
 const basis=await currentTurnBasis(transport,dialogue,currentIdentity(),expression_ref);
 if(pinned){assert.deepEqual(basis.context.personal_current,pinned.context);assert.deepEqual(basis.personal_current_reading,pinned.reading);}
 const sceneRef=document.selection.scene_ref,subjectRef=document.entities[document.selection.entity_ref].subject.subject_ref;
 const question=`For a controlled native interaction verification, name the current scene and the selected subject using their exact semantic references in backticks: scene ${sceneRef}, subject ${subjectRef}. Explain briefly that these are references in the current Expression. Do not change anything or issue any tool actions. Keep your reply to two sentences.`;
 await submitNativeTurn(transport,dialogue,nativeTurnText(question,basis,'nara'));
 let view,answer;const deadline=Date.now()+240000;
 while(Date.now()<deadline){
  view=await native({op:'encounter',project:config.project,request:{action:'view',agent_session:dialogue.provisioning.agent_session}});
  const block=view.blocks.filter(b=>b.kind==='assistant').at(-1);
  if(block&&view.blocks.some(b=>b.id>block.id&&b.kind==='completed')&&view.connection.state==='Resident'){answer=block;break;}
  if(view.blocks.some(b=>b.kind==='error'||b.kind==='cancelled'))throw Error('The actual native turn did not complete');
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 assert.ok(answer,'Actual native Nara answer did not complete before the deadline');
 const binding={...dialogue.binding,expected_revision:identity.source.revision};
 const act=request=>native({op:'nara_expressive_act',project:config.project,request:{binding,...request}});
 const review=await act({operation:'inspect',answer_block_id:answer.id});
 lastReview=review;
 assert.equal(review.schema,'oi.nara-expressive-act-review/v1');assert.equal(review.effect_applied,false);
 assert.ok(review.targets.some(t=>t.ref===sceneRef&&t.effect_required));
 assert.ok(review.targets.some(t=>t.ref===subjectRef&&!t.effect_required));assert.equal(review.choice_required,true);
 assert.deepEqual((await native({op:'expression',request:{operation:'inspect',expression_ref}})).document,document);
 checks.push('Actual completed native answer produces exact cited scene/subject choices without changing the Expression');
 const noop=await act({operation:'focus',answer_block_id:answer.id,target_ref:subjectRef});
 assert.equal(noop.effect_applied,false);assert.equal(noop.expression_revision,document.revision);
 await assert.rejects(()=>act({operation:'restore',act_ref:review.act_ref,expected_revision:document.revision}),/no retained checkpoint/);
 checks.push('An already selected subject is a native no-op and creates no phantom checkpoint');
 await assert.rejects(()=>act({operation:'focus',answer_block_id:answer.id,target_ref:subjectRef+':unadmitted'}),/unambiguous exact reference/);
 const {NativeExpressiveAct}=await server.ssrLoadModule('/src/nara/nativeExpressiveAct.ts');
 const ports={request:request=>act(request.operation==='act_focus'?{operation:'focus',answer_block_id:request.answer_block_id,target_ref:request.target_ref}:{operation:'restore',act_ref:request.act_ref,expected_revision:request.expected_revision}),
  stopSpeech:async()=>{if(voiceRef){await native({op:'nara_voice',project:config.project,request:{operation:'close',voice_ref:voiceRef}});voiceRef=null;}}};
 const controller=new NativeExpressiveAct(ports),instrumentBasis={expression_ref,source:identity.source};
 // A real native lease is closed by Stop. No manufactured speech capability,
 // transcript, acoustic sample or successful audio response enters this test.
 const opened=await native({op:'nara_voice',project:config.project,request:{operation:'open',binding,context:basis.context}});
 voiceRef=opened.voice_ref;assert.ok(voiceRef);
 controller.begin(review,instrumentBasis,binding.nara_ref,sceneRef,voiceRef);
 await controller.stop();assert.equal(await controller.advanceFocus(),null);
 assert.equal(controller.read().pending,0);assert.equal(controller.read().state.phase,'interrupted');
 assert.deepEqual((await native({op:'expression',request:{operation:'inspect',expression_ref}})).document,document);
 checks.push('Production act controller Stop cancels pending native focus and closes an actual native voice lease');
 const voice=await native({op:'nara_voice',project:config.project,request:{operation:'open',binding,context:basis.context}});voiceRef=voice.voice_ref;
 const speech=await native({op:'nara_voice',project:config.project,request:{operation:'speak',voice_ref:voiceRef,answer_block_id:answer.id}});
 assert.ok(speech.response_ref&&speech.audio?.audio_base64,'The real native speech owner must return synthesized audio');
 assert.ok(speech.answer.answer_block_ids.includes(answer.id));
 controller.begin(review,instrumentBasis,binding.nara_ref,sceneRef,speech.response_ref);
 assert.equal(await controller.advanceFocus(),null,'Focus cannot run before speech completion');
 browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
 const audioPage=await browser.newPage();
 const playback=await audioPage.evaluate(async encoded=>{
  const audio=new AudioContext(),bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
  try{const buffer=await audio.decodeAudioData(bytes.buffer),source=audio.createBufferSource();
   source.buffer=buffer;source.connect(audio.destination);await audio.resume();
   await new Promise((resolve,reject)=>{source.onended=resolve;try{source.start();}catch(error){reject(error);}});
   return {duration:buffer.duration,samples:buffer.length,sample_rate:buffer.sampleRate};
  }finally{await audio.close();}
 },speech.audio.audio_base64);
 assert.ok(playback.duration>0&&playback.samples>0);
 await native({op:'nara_voice',project:config.project,request:{operation:'complete',voice_ref:voiceRef,response_ref:speech.response_ref}});
 controller.speechCompleted(answer.id);
 const focused=await controller.advanceFocus();assert.equal(focused.effect_applied,true);
 assert.equal(focused.expression_revision,document.revision+1);assert.equal(focused.document.selection.entity_ref,null);
 assert.equal(controller.read().state.basis_expression_revision,String(focused.expression_revision));
 assert.equal(focused.document.selection.scene_ref,sceneRef);assert.deepEqual(focused.document.entities,document.entities);
 checks.push('Actual native answer synthesis completes before one native scene focus; revision advances and source-bound entities remain unchanged');
 let returnController=controller;
 if(config.context_join){
  const status=await act({operation:'status'});
  assert.equal(status.checkpoint_available,true);assert.equal(status.state.phase,'completed');
  assert.equal(status.state.basis_expression_revision,String(focused.expression_revision));
  assert.equal(status.state.checkpoint.checkpoint_expression_revision,String(document.revision));
  const afterContext=await native({op:'nara_dialogue',project:config.project,request:{...binding,operation:'context'}});
  assert.deepEqual(afterContext.context.expressive_act,status.state);
  assert.deepEqual(afterContext.context.personal_current,pinned.context);
  const retained=await native({op:'nara_current',project:config.project,request:{operation:'read',binding}});
  assert.deepEqual(retained.reading,pinned.reading);assert.equal(retained.expression_revision,focused.expression_revision);
  returnController=new NativeExpressiveAct(ports);returnController.recover(status,instrumentBasis,binding.nara_ref);
  assert.equal(returnController.read().pending,0);assert.deepEqual(returnController.read().answer_block_ids,[]);
  checks.push('Native context exposes completed act and same pinned event after focus; a fresh controller recovers only its checkpoint handle');
 }
 await assert.rejects(()=>act({operation:'restore',act_ref:review.act_ref+':other',expected_revision:focused.expression_revision}),/binding|changed|checkpoint/);
 assert.deepEqual((await native({op:'expression',request:{operation:'inspect',expression_ref}})).document,focused.document);
 await controller.stop();
 const restored=await returnController.restore();assert.equal(restored.effect_applied,true);
 assert.equal(restored.expression_revision,document.revision+2);assert.deepEqual(restored.document.selection,document.selection);
 const normalized={...restored.document,revision:document.revision};assert.deepEqual(normalized,document);
 assert.equal(returnController.read().state.basis_expression_revision,String(restored.expression_revision));
 if(config.context_join){
  assert.equal((await act({operation:'status'})).checkpoint_available,false);
  assert.deepEqual((await native({op:'nara_current',project:config.project,request:{operation:'read',binding}})).reading,pinned.reading);
 }
 checks.push('Only the stored native checkpoint restores the exact prior authored document, advancing revision rather than rewinding GPU or identity');
 await assert.rejects(()=>act({operation:'focus',answer_block_id:answer.id,target_ref:sceneRef}),/differs|changed|current|context/);
 const continued=await native({op:'nara_dialogue',project:config.project,request:{...binding,operation:'lookup'}});
 assert.equal(continued.provisioning.agent_session,dialogue.provisioning.agent_session);assert.equal(continued.binding.nara_ref,binding.nara_ref);
 checks.push('An old answer cannot reapply after restore; native lookup preserves the same canonical Nara and AgentSession');
 await writeFile(path.join(output,'receipt.json'),JSON.stringify({schema:'oi.nara-expressive-act-native-verification/v1',passed:true,expression_ref,checks,sources,events,
  answer_block_ids:review.answer_block_ids,act_ref:review.act_ref,checkpoint_ref:review.checkpoint_ref,
  revisions:[document.revision,focused.expression_revision,restored.expression_revision],
  playback,limits:['Actual native model, synthesis, browser AudioContext playback to completion, focus, checkpoint and production controller; not audible speaker, microphone or installed UI proof.',
   'Only exact current selected-subject and scene references are admitted; this does not claim all-centre targeting or TA3 completion.']},null,2));
 console.log(JSON.stringify({passed:true,checks:checks.length,receipt:path.join(output,'receipt.json')}));
}catch(error){await writeFile(path.join(output,'failure.json'),JSON.stringify({error:String(error),expression_ref,checks,sources,events,review:lastReview},null,2));throw error;}
finally{
 try{if(voiceRef)await native({op:'nara_voice',project:config.project,request:{operation:'close',voice_ref:voiceRef}});
  if(dialogue){const session=dialogue.provisioning.agent_session;const status=await native({op:'encounter',project:config.project,request:{action:'status',agent_session:session}});
   if(['TurnInFlight','InterruptRequested'].includes(status.state))await native({op:'encounter',project:config.project,request:{action:'cancel',agent_session:session,reason:'Controlled ExpressiveAct verification ended'}});}
 }catch(error){process.exitCode=1;await writeFile(path.join(output,'cleanup-failure.json'),JSON.stringify({error:String(error)}));}
 try{if(created)await closeControlledExpression(server,config.bridge,expression_ref,output,'Controlled ExpressiveAct native verification ended; exact result retained');}
 finally{await browser?.close();await server.close();}
}
