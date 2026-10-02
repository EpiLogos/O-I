#!/usr/bin/env node
/** Mounted ordinary UI fresh native question/answer -> explicit Keep -> Read.
 * Uses the externally qualified disposable native application/body, never a
 * mocked parent, configured answer, fake native response or new provider.
 * No process is relaunched here: restart proof requires the second read mode
 * plus an independently retained actual new-process witness. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,stat,realpath,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {createServer} from 'vite';
const cfg=JSON.parse(await readFile(process.argv[2],'utf8')),hash=b=>createHash('sha256').update(b).digest('hex');
assert.match(cfg.bridge,/^http:\/\/127\.0\.0\.1:\d+$/);assert.match(cfg.app_url,/^http:\/\/127\.0\.0\.1:\d+\//);
assert.equal(resolve(cfg.world),cfg.world);assert.ok(cfg.world.endsWith('/world'));assert.equal(await realpath(cfg.world),cfg.world);
const macControlled=cfg.world.includes('/Control/agents/now/clearings/')&&cfg.world.includes('/T/');
const temporaryRoots=[await realpath(tmpdir()),...(process.env.RUNNER_TEMP?[await realpath(process.env.RUNNER_TEMP)]:[])];
assert.ok(macControlled||temporaryRoots.some(root=>cfg.world.startsWith(root+'/')),'The gate needs an explicitly qualified controlled temporary native world');
assert.equal(resolve(cfg.output),cfg.output);assert.ok(cfg.output.startsWith(resolve(cfg.world,'..')+'/'));
assert.ok(cfg.output!==cfg.world&&!cfg.output.startsWith(cfg.world+'/'),'Evidence must not be written into the native world');assert.ok(['nara','epii'].includes(cfg.role));
assert.ok(!('answer' in cfg)&&!('expected_answer' in cfg)&&!('provider' in cfg));assert.ok(['fresh','restart-read'].includes(cfg.mode));
await mkdir(cfg.output,{recursive:true});assert.equal(await realpath(cfg.output),cfg.output);
assert.equal((await readdir(cfg.output)).length,0,'Refuse to overwrite retained gate evidence');
async function bounded(p,cap=64*1024*1024){const s=await stat(p);assert.ok(s.isFile()&&s.size<=cap);const b=await readFile(p);assert.ok(b.length<=cap);return b;}
async function responseBytes(response){assert.ok(response.ok,'HTTP '+response.status);const reader=response.body.getReader(),parts=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>64*1024*1024)throw Error('Actual native response exceeds its receiving budget');parts.push(Buffer.from(value));}}catch(error){await reader.cancel();throw error;}finally{reader.releaseLock();}return Buffer.concat(parts);
}
const qualificationBytes=await bounded(cfg.qualification,2*1024*1024),qualification=JSON.parse(qualificationBytes);
assert.equal(hash(qualificationBytes),cfg.qualification_sha256);assert.equal(qualification.world,cfg.world);
assert.equal(qualification.expression_ref,cfg.expression_ref);assert.equal(qualification.identity_source_ref,cfg.identity_source_ref);
assert.equal(qualification.body_route,'actual-native-default-epi-prime-ql');assert.ok(qualification.native_process&&qualification.all_five&&qualification.frontend&&qualification.aikit);
const captureSource=await bounded(resolve('expressions-app/field-studies-journeys/src/capture.ts'),1024*1024);
const captureGenerated=await bounded(resolve('../../packages/oi-design-system/expressions-engine/shell/capture.mjs'),1024*1024);
const captureProvenance=JSON.parse(await bounded(resolve('../../packages/oi-design-system/expressions-engine/PROVENANCE.json'),2*1024*1024));
const captureReceipt=captureProvenance.module_refreshes?.['shell/capture.mjs'];assert.ok(captureReceipt);
assert.equal(hash(captureSource),captureReceipt.source_sha256);assert.equal(hash(captureGenerated),captureReceipt.output_sha256);assert.match(captureReceipt.compiler,/^esbuild@/);
// This external receipt is retained evidence to be independently challenged;
// accepting its name alone is not a loaded binary/module/provider proof.
const report={schema:'oi.nara-answer-expression-browser-gate/v1',passed:false,qualification:{path:cfg.qualification,sha256:cfg.qualification_sha256,capture:{source_sha256:hash(captureSource),generated_sha256:hash(captureGenerated),receipt:captureReceipt}},checks:[],observations:[],native:[],limits:['Controlled browser and actual configured native body','Restart identity independently witnessed by parent','No installed/hardware GPU/audio/H acceptance']};
let browser,page,frame,ssr;
const native=async(op,request)=>{
 const body=JSON.stringify(op==='nara_dialogue'||op==='encounter'?{op,project:cfg.project,request}:{op,request});assert.ok(Buffer.byteLength(body)<=32*1024*1024);
 const bytes=await responseBytes(await fetch(cfg.bridge+'/op',{method:'POST',headers:{'Content-Type':'application/json'},body}));
 const value=JSON.parse(bytes);assert.equal(value.ok,true,JSON.stringify(value));assert.equal(value.outcome.result,op==='encounter'?'encounter_reading':op);report.native.push({op,request,response_sha256:hash(bytes),response_bytes:bytes.length});return value.outcome.data;
};
try{
 browser=await chromium.launch({headless:true});page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>{report.observations.push({page_error:String(e)});});
 await page.goto(cfg.app_url);await page.waitForSelector('iframe', {timeout:30000});
 const candidates=page.frames().filter(f=>f.url().includes('field-studies'));assert.equal(candidates.length,1,'Actual ordinary Expressions frame must be mounted');frame=candidates[0];
 await frame.waitForFunction(()=>!!window.__FIELD_STUDIES__?.nativeWorking(),null,{timeout:30000});
 const showing=await frame.evaluate(()=>window.__FIELD_STUDIES__.nativeWorking());assert.equal(showing.native_ref,cfg.expression_ref);assert.ok(!showing.pending);assert.equal(showing.busy,false);
 const before=(await native('expression',{operation:'inspect',expression_ref:cfg.expression_ref}));assert.equal(before.dirty,false);assert.ok(before.file);assert.equal(before.file.location.root,cfg.world);assert.ok(!before.file.location.path.startsWith('/')&&!before.file.location.path.split('/').includes('..'));
 const carrier=before.document.scenes.find(s=>s.presentation?.scene?.epiWorld).presentation.scene.epiWorld;
 assert.equal(carrier.person_ref,cfg.person_ref);assert.equal(carrier.identity_source.source_ref,cfg.identity_source_ref);
 assert.equal(carrier.receiving.personal.canonical_locus,'ql:m-coordinate:bimba:M4.4.4.4');
 const currentScene=before.document.selection.scene_ref,currentEntity=before.document.selection.entity_ref;
 assert.equal(before.document.entities[currentEntity].subject.subject_ref,'ql:m-coordinate:bimba:M4.4.4.4');
 let answer,kept,submitted;
 const binding={operation:'lookup',source_ref:cfg.identity_source_ref,expected_revision:carrier.identity_source.revision,person_ref:carrier.person_ref,nara_ref:carrier.nara_ref,expression_ref:cfg.expression_ref,role:cfg.role};
 ssr=await createServer({configFile:false,root:process.cwd(),cacheDir:join(cfg.output,'vite-ssr'),server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
 const owner=await ssr.ssrLoadModule('/src/nara/nativeReturn.ts'),material=await ssr.ssrLoadModule('/src/nara/nativeKeptAnswer.ts'),nativeOwner=await ssr.ssrLoadModule('/src/nara/nativeAnswerExpression.ts');
 const transport={kind:'bridge',url:cfg.bridge};
 const instrument=frame.getByRole('region',{name:'Nara Expression instrument'});
 if(!await instrument.isVisible())await frame.locator('.nara-instrument-trigger').click();await instrument.getByRole('button',{name:'With Nara',exact:true}).click();
 await instrument.getByRole('button',{name:cfg.role==='epii'?'Ask Epii':'Nara',exact:true}).click();
 if(cfg.mode==='fresh'){
  assert.ok(typeof cfg.question==='string'&&cfg.question.trim()&&cfg.question.length<=16384);
  const lookup=await native('nara_dialogue',binding),session=lookup.provisioning?.agent_session;
  let beforeMax=-1;if(session){const view=await native('encounter',{action:'view',agent_session:session});
   assert.equal(view.more,false,'Fresh named body proof requires complete initial native history');
   assert.ok(!view.blocks.some(b=>['user','assistant','completed','cancelled','error'].includes(b.kind)),'A prior native turn cannot qualify this controlled fresh body');
   beforeMax=Math.max(-1,...view.blocks.map(b=>b.id));report.initial_native_history={agent_session:session,blocks:view.blocks};
  }
  const uiRequests=[],uiDrafts=[];
  const listener=async event=>{if(event.url()!==cfg.bridge+'/op'||event.request().method()!=='POST')return;const request=event.request().postDataJSON();
   if(request.op==='encounter'&&request.request.action==='prompt')uiRequests.push(request);if(request.op==='encounter'&&request.request.action==='draft'&&request.request.text)uiDrafts.push(request);};page.on('response',listener);
  const promptReply=page.waitForResponse(response=>{if(response.url()!==cfg.bridge+'/op'||response.request().method()!=='POST')return false;const v=response.request().postDataJSON();return v.op==='encounter'&&v.project===cfg.project&&v.request.action==='prompt';},{timeout:180000}).then(response=>({response}),error=>({error}));
  await instrument.locator('#nara-instrument-question').fill(cfg.question);
  await instrument.getByRole('button',{name:cfg.role==='epii'?'Request inquiry':'Send',exact:true}).click();
  const promptResult=await promptReply;if(promptResult.error)throw promptResult.error;
  // The actual walk-bridge owner always sends a bounded Content-Length.
  // Qualify it before asking Playwright for this unchanged UI response body.
  assert.equal(promptResult.response.ok(),true);const declared=promptResult.response.headers()['content-length'];assert.match(declared??'',/^(0|[1-9][0-9]*)$/);
  const declaredBytes=Number(declared);assert.ok(Number.isSafeInteger(declaredBytes)&&declaredBytes<=64*1024*1024);
  const promptBytes=await promptResult.response.body();assert.equal(promptBytes.length,declaredBytes);const promptAcknowledgement=JSON.parse(promptBytes);assert.equal(promptAcknowledgement.ok,true,JSON.stringify(promptAcknowledgement));
  report.observations.push({actual_prompt_acknowledgement:promptAcknowledgement,sha256:hash(promptBytes)});
  // A completed native terminal is required. UI timeout is a refusal, never
  // a substitute answer or a retry of the original model turn.
  const resolved=await native('nara_dialogue',binding),dialogue={key:JSON.stringify(resolved.binding),project:cfg.project,role:cfg.role,binding:resolved.binding,provisioning:resolved.provisioning};
  const deadline=Date.now()+180000;
  for(;;){const view=await native('encounter',{action:'view',agent_session:dialogue.provisioning.agent_session}),completed=view.blocks.filter(b=>b.kind==='assistant'&&b.id>beforeMax).at(-1);
   if(view.blocks.some(b=>b.id>beforeMax&&(b.kind==='error'||b.kind==='cancelled')))throw Error('The actual fresh native turn failed or was cancelled.');
   if(completed&&view.connection?.state==='Resident'&&view.blocks.some(b=>b.id>completed.id&&b.kind==='completed')){const {EPI_PRIME_QL_BODY_REF}=await ssr.ssrLoadModule('/src/encounter/client.ts');assert.equal(view.connection.provider.body_ref,EPI_PRIME_QL_BODY_REF);if(qualification.aikit.body_revision)assert.equal(view.connection.provider.body_revision,qualification.aikit.body_revision);report.observations.push({actual_native_provider:{body_ref:view.connection.provider.body_ref,body_revision:view.connection.provider.body_revision,native_session_id:view.connection.native_session_id}});answer=await owner.readNativeAnswer(transport,dialogue,completed.id);break;}
   if(Date.now()>deadline)throw Error('No actual completed native fresh turn within the declared gate interval.');await new Promise(resolve=>setTimeout(resolve,250));
  }
  page.off('response',listener);
  assert.equal(answer.question,cfg.question);assert.ok(answer.questionBlockIds.every(n=>n>beforeMax));
  assert.equal(answer.basis.source_projection.selected_source_basis.identity.uuid,'dcb274c1-fbbc-5914-b27d-dea979c78558');assert.equal(answer.basis.source_projection.selected_source_basis.source_revision,'907c46bc8a65b47e12f14aa4d8b444263dc956a1a7b4b6d038e57223d6073288');assert.equal(answer.basis.context.subject_ref,cfg.person_ref);
  assert.equal(uiRequests.length,1,'Exactly one actual prompt must traverse the existing UI/native encounter owner');
  assert.equal(uiDrafts.length,1,'Exactly one actual question envelope must reach native draft CAS');const input=JSON.parse(uiDrafts[0].request.text);assert.equal(input.question,cfg.question);assert.equal(input.expression.ref,cfg.expression_ref);assert.equal(input.selected_source_basis.identity.uuid,'dcb274c1-fbbc-5914-b27d-dea979c78558');
  submitted={schema:'oi.nara-fresh-ui-turn-receipt/v1',world:cfg.world,role:cfg.role,expression_ref:cfg.expression_ref,agent_session_ref:dialogue.provisioning.agent_session,before_max_block_id:beforeMax,question:cfg.question,
   submission_request:{operation:cfg.role==='epii'?'epii_delegate':'send',question:cfg.question},native_prompt_request:uiRequests[0],native_draft_request:uiDrafts[0],answer_block_id:answer.blockId};
  await writeFile(join(cfg.output,'fresh-ui-turn.json'),JSON.stringify(submitted,null,2));
  const beforeKeep=await frame.evaluate(()=>{const a=window.__FIELD_STUDIES__,s=a.getState();return {current:a.epiCurrent(),native:a.native(),engine:a.inspect(false),position:{sceneIndex:s.sceneIndex,camera:s.camera,selected:s.selected,simTime:s.simTime,sceneElapsed:s.sceneElapsed,fieldPaused:s.fieldPaused}};});
  assert.equal(beforeKeep.position.fieldPaused,true,'Hold the native personal field before Keep invariance proof');assert.equal(beforeKeep.current.status,'available');
  assert.ok(Number.isFinite(beforeKeep.engine.simTime)&&Number.isSafeInteger(beforeKeep.engine.steps)&&Number.isSafeInteger(beforeKeep.engine.seeds),'Actual resident engine readings required');
  assert.equal(beforeKeep.engine.localizedResonance.length,9);assert.equal(new Set(beforeKeep.engine.localizedResonance.map(m=>m.driverRef)).size,9);assert.equal(new Set(beforeKeep.engine.localizedResonance.map(m=>m.entityId)).size,7);
  assert.ok(beforeKeep.engine.localizedResonance.every(m=>Number.isFinite(m.frequencyHz)&&m.frequencyHz>0));
  const returnTool=instrument.locator('[data-native-answer-block-id='+JSON.stringify(String(answer.blockId))+']');await returnTool.getByRole('button',{name:'Keep this answer',exact:true}).click();
  await returnTool.getByRole('button',{name:'Keep in this Expression',exact:true}).click();
  await frame.waitForFunction(({ref,revision})=>{const s=window.__FIELD_STUDIES__.nativeWorking();return s.native_ref===ref&&s.revision>revision&&!s.busy&&!s.pending;},{ref:cfg.expression_ref,revision:before.document.revision},{timeout:30000});
  const after=await nativeOwner.readNativeAnswerExpression(transport,cfg.expression_ref),answerRef=await owner.answerId(answer);kept=(await material.readKeptAnswers(after.document)).find(r=>r.record.answer_ref===answerRef);
  assert.ok(kept);assert.equal(kept.body,answer.answer);assert.equal(kept.primary,answer.epii?.enrichment.synthesis??answer.answer);
  assert.equal(after.file.location.ref,before.file.location.ref);assert.equal(after.document.selection.scene_ref,currentScene);assert.equal(after.document.selection.entity_ref,currentEntity);
  const viewState=await frame.evaluate(()=>({state:window.__FIELD_STUDIES__.getState(),document:window.__FIELD_STUDIES__.getDocument()}));
  assert.equal(viewState.document.scenes[viewState.state.sceneIndex].id,before.document.scenes.find(s=>s.scene_ref===currentScene).presentation.scene.id);
  const afterKeep=await frame.evaluate(()=>{const a=window.__FIELD_STUDIES__,s=a.getState();return {current:a.epiCurrent(),native:a.native(),engine:a.inspect(false),position:{sceneIndex:s.sceneIndex,camera:s.camera,selected:s.selected,simTime:s.simTime,sceneElapsed:s.sceneElapsed,fieldPaused:s.fieldPaused}};});
  assert.deepEqual(afterKeep.position,beforeKeep.position);assert.deepEqual(afterKeep.current,beforeKeep.current);
  for(const key of ['steps','simTime','seeds','localizedResonance'])assert.deepEqual(afterKeep.engine[key],beforeKeep.engine[key]);
  for(const key of ['domain','event','acting','readback','clock'])if(key in beforeKeep.native)assert.deepEqual(afterKeep.native[key],beforeKeep.native[key]);
  report.continuity={before:beforeKeep,after:afterKeep,limits:'Exact observed held current/position/nine resident modes/seven targets and exposed native readings; whole nine-mode GPU/audio causal gate remains separately mandatory'};
  report.checks.push('One actual new native UI prompt/completed terminal, exact original PersonalPratibimba basis, explicit mounted Keep and same-file native readback');
 }else{
  const witnessBytes=await bounded(cfg.restart_witness,2*1024*1024),witness=JSON.parse(witnessBytes);assert.equal(hash(witnessBytes),cfg.restart_witness_sha256);
  assert.equal(witness.world,cfg.world);assert.notEqual(witness.previous_pid,witness.current_pid);assert.equal(witness.previous_pid_alive,false);assert.equal(witness.current_pid_alive,true);
  report.restart_witness={path:cfg.restart_witness,sha256:cfg.restart_witness_sha256,limits:'Independent producer receipt must qualify actual process image/root; PID values alone do not'};
  const priorBytes=await bounded(cfg.original_receipt),prior=JSON.parse(priorBytes);assert.equal(hash(priorBytes),cfg.original_receipt_sha256);assert.equal(prior.passed,true);
  const after=await nativeOwner.readNativeAnswerExpression(transport,cfg.expression_ref);kept=(await material.readKeptAnswers(after.document)).find(r=>r.record.answer_ref===prior.kept.record.answer_ref);
  assert.deepEqual(kept,prior.kept);assert.equal(after.file.revision,prior.saved_file.revision);report.checks.push('Actual new-process witnessed reopening retains complete saved native quotation and reference basis; no provider invocation required');
 }
 const row=instrument.getByRole('region',{name:'Kept answers'}).locator('[data-kept-answer-ref='+JSON.stringify(kept.record.answer_ref)+']');await row.getByRole('button',{name:'Read answer',exact:true}).click();
 await instrument.waitFor({state:'hidden'});let primary='',source='';
 for(const ref of [...new Set(kept.record.parts.map(p=>p.scene_ref))]){
  const raw=await frame.evaluate(()=>window.__FIELD_STUDIES__.getDocument()),pageMaterial=raw.scenes.find(s=>s.text.some(t=>kept.record.parts.filter(p=>p.scene_ref===ref).some(p=>p.layer_ids.includes(t.id))));
  assert.ok(pageMaterial);const index=raw.scenes.findIndex(s=>s.id===pageMaterial.id),was=await frame.evaluate(()=>window.__FIELD_STUDIES__.getState().sceneIndex);assert.equal(await frame.evaluate(i=>window.__FIELD_STUDIES__.setScene(i),index),index!==was);
  await frame.locator('[data-native-scene-ref='+JSON.stringify(ref)+']').waitFor();
  for(const width of [360,760,1000,1440]){await page.setViewportSize({width,height:900});const reading=frame.locator('[data-native-scene-ref='+JSON.stringify(ref)+']');await reading.waitFor();
   const sourceSummary=reading.getByText('Source Inspect · original native answer',{exact:true});
   if(await sourceSummary.count()&&!await sourceSummary.evaluate(el=>el.parentElement.open))await sourceSummary.click();
   const sample=await reading.evaluate(el=>({primary:el.querySelector('[data-native-answer-primary]')?.textContent??'',source:el.querySelector('[data-native-answer-source]')?.textContent??'',sizes:[...el.querySelectorAll('[data-native-answer-primary],[data-native-answer-source]')].map(e=>getComputedStyle(e).fontSize),scrollHeight:el.scrollHeight,clientHeight:el.clientHeight}));
   assert.ok(sample.sizes.every(n=>n==='18px'));assert.equal(sample.primary,kept.record.parts.filter(p=>p.scene_ref===ref&&p.kind==='primary').flatMap(p=>p.layer_ids).map(id=>pageMaterial.text.find(t=>t.id===id).body).join(''));
   assert.equal(sample.source,kept.record.parts.filter(p=>p.scene_ref===ref&&p.kind==='source').flatMap(p=>p.layer_ids).map(id=>pageMaterial.text.find(t=>t.id===id).body).join(''));
   const captured=await frame.evaluate(async id=>{const api=window.__FIELD_STUDIES__,d=api.getDocument(),current=d.scenes[api.getState().sceneIndex];if(current.id!==id)throw Error('Capture belongs to another Scene');
    const {captureTextLayers,paintText}=await import('/generated/capture.mjs'),joined=captureTextLayers(current);if(joined.length!==1)throw Error('Native quote chunks did not form one actual capture body');
    const canvas=document.createElement('canvas');canvas.width=innerWidth;canvas.height=innerHeight;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Real Canvas2D unavailable');
    const calls=[],fill=ctx.fillText.bind(ctx);ctx.fillText=(...args)=>{calls.push({font:ctx.font,text:args[0]});return fill(...args);};paintText(ctx,current,innerWidth,innerHeight);
    return{joined_body:joined[0].body,body_calls:calls.filter(c=>c.font==='18px Arial'),canvas:canvas.toDataURL('image/png')};},pageMaterial.id);
   const expectedCapture=sample.primary+(sample.primary&&sample.source?'\n\nSource Inspect · original native answer\n':'')+sample.source;
   assert.equal(captured.joined_body,expectedCapture);assert.equal(captured.body_calls.map(c=>c.text).join(''),expectedCapture.replace(/\n/g,''),'Actual painter must retain every literal body character across word and grapheme line breaks');
   const capturePng=Buffer.from(captured.canvas.split(',')[1],'base64');assert.ok(capturePng.length<=4*1024*1024);await writeFile(join(cfg.output,'capture-'+ref.replace(/[^a-z0-9]/gi,'_')+'-'+width+'.png'),capturePng);delete captured.canvas;
   await reading.focus();await reading.press('End');report.observations.push({ref,width,...sample,capture:captured});await page.screenshot({path:join(cfg.output,'reading-'+ref.replace(/[^a-z0-9]/gi,'_')+'-'+width+'.png')});
   if(width===1440){primary+=sample.primary;source+=sample.source;}
  }
 }
 assert.equal(primary,kept.primary);assert.equal(cfg.role==='epii'?source:primary,kept.body);
 await frame.locator('.nara-kept-answer').focus();await page.keyboard.press('Control+s');
 await frame.waitForFunction(()=>{const s=window.__FIELD_STUDIES__.nativeWorking();return !s.busy&&!s.pending;});
 const saved=await nativeOwner.readNativeAnswerExpression(transport,cfg.expression_ref);assert.deepEqual((await nativeOwner.readStoredNativeAnswers(transport,saved.document)).find(r=>r.record.answer_ref===kept.record.answer_ref),kept);
 const file=await bounded(join(cfg.world,saved.file.location.path));
 assert.ok(!report.observations.some(o=>o.page_error),'Mounted ordinary UI page errors refuse acceptance');
 Object.assign(report,{passed:true,kept,submitted,saved_file:{...saved.file,bytes:file.length,sha256:hash(file)}});
 report.checks.push('Every complete native quote layer consumed by ordinary grouped18px selectable reading body and actual generated Canvas2D painter at four viewports; a static capture shows one viewport, full text remains ordinary scroll/Scene material');
}catch(error){report.error=String(error);process.exitCode=1;
 if(frame)try{const stop=frame.getByRole('button',{name:'Stop response',exact:true});if(await stop.isVisible())await stop.click();}catch(cleanup){report.cleanup_error=String(cleanup);}
}finally{const settled=await Promise.allSettled([browser?.close(),ssr?.close()]);const errors=settled.filter(r=>r.status==='rejected').map(r=>String(r.reason));if(errors.length){report.passed=false;report.cleanup_errors=errors;process.exitCode=1;}await writeFile(join(cfg.output,'receipt.json'),JSON.stringify(report,null,2));}
