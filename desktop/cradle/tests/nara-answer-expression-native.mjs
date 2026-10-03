#!/usr/bin/env node
/** Real completed-turn -> native Act/Edition -> same bound file gate.
 * Input names an actual newly submitted native UI turn, not supplied answer
 * text. Run from desktop/cradle in the already isolated controlled world.
 * Mounted UI, cold independent restart, GPU, audio and H are separate gates. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,stat,realpath,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createServer} from 'vite';
const hash=b=>createHash('sha256').update(b).digest('hex');
const execFileAsync=promisify(execFile);
const cfg=JSON.parse(await readFile(process.argv[2],'utf8'));
assert.match(cfg.bridge,/^http:\/\/127\.0\.0\.1:\d+$/);
assert.equal(resolve(cfg.world),cfg.world);assert.ok(cfg.world.endsWith('/world'));assert.equal(await realpath(cfg.world),cfg.world);
const macControlled=cfg.world.includes('/Control/agents/now/clearings/')&&cfg.world.includes('/T/');
const temporaryRoots=[await realpath(tmpdir()),...(process.env.RUNNER_TEMP?[await realpath(process.env.RUNNER_TEMP)]:[])];
assert.ok(macControlled||temporaryRoots.some(root=>cfg.world.startsWith(root+'/')),'The gate needs an explicitly qualified controlled temporary native world');
assert.equal(resolve(cfg.output),cfg.output);assert.ok(cfg.output.startsWith(resolve(cfg.world,'..')+'/'));
assert.ok(cfg.output!==cfg.world&&!cfg.output.startsWith(cfg.world+'/'),'Evidence must not be written into the native world');
assert.ok(['nara','epii'].includes(cfg.binding.role));
assert.ok(!('answer' in cfg)&&!('expected_answer' in cfg)&&!('provider' in cfg));
await mkdir(cfg.output,{recursive:true});assert.equal(await realpath(cfg.output),cfg.output);
assert.equal((await readdir(cfg.output)).length,0,'Refuse to overwrite retained gate evidence');
async function bounded(p,cap=64*1024*1024){const s=await stat(p);assert.ok(s.isFile()&&s.size<=cap);const b=await readFile(p);assert.ok(b.length<=cap);return b;}
const submittedBytes=await bounded(cfg.submitted_turn_receipt,2*1024*1024),submitted=JSON.parse(submittedBytes);
assert.equal(hash(submittedBytes),cfg.submitted_turn_sha256);
assert.equal(submitted.schema,'oi.nara-fresh-ui-turn-receipt/v1');
assert.equal(submitted.world,cfg.world);assert.equal(submitted.role,cfg.binding.role);
assert.equal(submitted.expression_ref,cfg.binding.expression_ref);assert.equal(submitted.answer_block_id,cfg.block_id);assert.ok(Number.isSafeInteger(submitted.before_max_block_id));
assert.ok(submitted.submission_request.operation==='send'||submitted.submission_request.operation==='epii_delegate');
assert.equal(submitted.submission_request.question,submitted.question);
// The configured path is joined to the parent's actual launch evidence and
// to the running controlled bridge's environment/lifetime, never ambient HOME.
assert.equal(resolve(cfg.oi_home),cfg.oi_home);assert.equal(await realpath(cfg.oi_home),cfg.oi_home);
assert.ok(cfg.oi_home.startsWith(resolve(cfg.world,'..')+'/')&&cfg.oi_home!==cfg.world&&!cfg.oi_home.startsWith(cfg.world+'/'));
const qualificationBytes=await bounded(cfg.qualification,2*1024*1024),qualification=JSON.parse(qualificationBytes);
assert.equal(hash(qualificationBytes),cfg.qualification_sha256);
assert.equal(qualification.world,cfg.world);assert.equal(qualification.oi_home,cfg.oi_home);
assert.equal(qualification.native_process.bridge,cfg.bridge);
assert.equal(qualification.native_process.environment.OI_HOME,cfg.oi_home);
assert.equal(qualification.native_process.environment.OI_CENTRAL_ROOT,cfg.world);
assert.ok(Number.isSafeInteger(qualification.native_process.pid)&&qualification.native_process.pid>0);
assert.equal(typeof qualification.native_process.start,'string');assert.ok(qualification.native_process.start);
const inspectOwnedProcess=async()=>{
 const pid=qualification.native_process.pid;process.kill(pid,0);
 let start,selected;
 if(process.platform==='linux'){
  const status=(await bounded(`/proc/${pid}/stat`,64*1024)).toString('utf8');
  start=status.slice(status.lastIndexOf(')')+2).trim().split(/\s+/)[19];
  const entries=(await bounded(`/proc/${pid}/environ`,1024*1024)).toString('utf8').split('\0');
  const value=key=>{const rows=entries.filter(row=>row.startsWith(key+'='));assert.equal(rows.length,1);return rows[0].slice(key.length+1);};
  selected={OI_HOME:value('OI_HOME'),OI_CENTRAL_ROOT:value('OI_CENTRAL_ROOT')};
 }else if(process.platform==='darwin'){
  // ps does not quote environment values: this gate refuses ambiguous paths.
  assert.ok(!/\s/.test(cfg.oi_home+cfg.world));
  start=(await execFileAsync('/bin/ps',['-p',String(pid),'-o','lstart='],{maxBuffer:64*1024})).stdout.trim();
  const command=(await execFileAsync('/bin/ps',['eww','-p',String(pid),'-o','command='],{maxBuffer:1024*1024})).stdout;
  for(const [key,value] of Object.entries({OI_HOME:cfg.oi_home,OI_CENTRAL_ROOT:cfg.world}))
   assert.ok(command.split(/\s+/).includes(key+'='+value),`Running native bridge lacks exact ${key}`);
  selected={OI_HOME:cfg.oi_home,OI_CENTRAL_ROOT:cfg.world};
 }else throw Error('No actual controlled native bridge environment/lifetime reader on this platform');
 assert.equal(start,qualification.native_process.start,'Native bridge process lifetime changed');
 assert.equal(selected.OI_HOME,cfg.oi_home);assert.equal(selected.OI_CENTRAL_ROOT,cfg.world);
 return {pid,start,environment:selected,bridge:cfg.bridge,scope:'Actual selected process environment/lifetime; bridge URL and image are independently launch-qualified by parent'};
};
const launchReadback=await inspectOwnedProcess();
const checks=[],requests=[],report={schema:'oi.nara-answer-expression-native-gate/v1',standing:'not executed',checks,requests,
 qualification:{path:cfg.qualification,sha256:cfg.qualification_sha256,launch:launchReadback}};
const server=await createServer({configFile:false,root:process.cwd(),cacheDir:join(cfg.output,'vite-ssr-cache'),server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try{
 const bridge=await server.ssrLoadModule('/src/kernel/bridge.ts'),native=await server.ssrLoadModule('/src/nara/nativeReturn.ts'),owner=await server.ssrLoadModule('/src/nara/nativeAnswerExpression.ts'),material=await server.ssrLoadModule('/src/nara/nativeKeptAnswer.ts');
 const transport={kind:'bridge',url:cfg.bridge};
 const op=async value=>{const result=await bridge.kernelOp(transport,value);requests.push({request:value,response:result});assert.ok(!result.error,result.error);return result.outcome.data;};
 const resolved=await op({op:'nara_dialogue',project:cfg.project,request:{...cfg.binding,operation:'lookup'}});
 assert.ok(resolved.provisioning?.agent_session);assert.equal(resolved.provisioning.agent_session,submitted.agent_session_ref);
 const dialogue={key:JSON.stringify(resolved.binding),role:cfg.binding.role,project:cfg.project,binding:resolved.binding,provisioning:resolved.provisioning};
 const answer=await native.readNativeAnswer(transport,dialogue,cfg.block_id);
 assert.equal(answer.question,submitted.question);assert.ok(answer.questionBlockIds.every(n=>n>submitted.before_max_block_id));assert.ok(answer.answerBlockIds.every(n=>n>submitted.before_max_block_id));
 assert.equal(answer.basis.context.subject_ref,cfg.binding.person_ref);assert.equal(answer.basis.identity_source.source_ref,cfg.binding.source_ref);
 assert.equal(answer.basis.source_projection.selected_source_basis.identity.uuid,'dcb274c1-fbbc-5914-b27d-dea979c78558');assert.equal(answer.basis.source_projection.selected_source_basis.source_revision,'907c46bc8a65b47e12f14aa4d8b444263dc956a1a7b4b6d038e57223d6073288');
 // The current original submit envelope is recovered from the canonical
 // native transcript by nativeReturn, never from a supplied answer fixture.
 const context=await op({op:'nara_dialogue',project:cfg.project,request:{...cfg.binding,operation:'context'}});
 const basis=await owner.readNativeAnswerExpression(transport,cfg.binding.expression_ref);
 const source=context.selected_source_content,scene=context.selected_scene_native_basis;
 const input={selected:answer.basis.selected,context:context.context,
  selected_source_basis:{source_revision:source.source_revision,registry_revision:source.registry_revision,identity:Object.fromEntries(Object.entries(source.identity).filter(([k])=>k!=='properties')),relation_count:source.relations.length,content_in_turn:new TextEncoder().encode(JSON.stringify(source)).length<=64*1024?'complete':'native-source-entrance'},
  selected_source_relation:context.selected_source_relation??null,selected_scene_native_basis:scene};
 assert.equal(basis.file.location.root,cfg.world);assert.ok(!basis.file.location.path.startsWith('/')&&!basis.file.location.path.split('/').includes('..'));
 const before=JSON.stringify(basis.document),fileBefore=await bounded(join(cfg.world,basis.file.location.path));
 await assert.rejects(()=>native.readNativeAnswer(transport,{...dialogue,binding:{...dialogue.binding,person_ref:'controlled:wrong-person'}},cfg.block_id),/bound person/);
 await assert.rejects(()=>owner.keepNativeAnswerInExpression(transport,{...answer,answer:answer.answer+' altered outside the native transcript'},input,()=>{}),/changed/);
 await assert.rejects(()=>owner.planNativeAnswerExpression(basis.document,answer,{...input,selected_scene_native_basis:{...input.selected_scene_native_basis,event_ref:'controlled:wrong-occasion'}}),/exact current person/);
 assert.ok(basis.document.revision>0);
 const refusedPlan=await owner.planNativeAnswerExpression(basis.document,answer,input);
 const beforeActs=await op({op:'expression_world',request:{operation:'act_list',expression_ref:cfg.binding.expression_ref}});
 const stale=await op({op:'expression_world',request:{operation:'act_perform',act_ref:'act:controlled-answer-stale-'+answer.blockId,expression_ref:cfg.binding.expression_ref,expected_revision:basis.document.revision-1,summary:'Actual stale answer receiver CAS refusal',actor:'agent:native-answer-gate',changes:refusedPlan.changes}});
 assert.equal(stale.state,'revision_conflict');assert.deepEqual(await op({op:'expression_world',request:{operation:'act_list',expression_ref:cfg.binding.expression_ref}}),beforeActs);
 assert.equal(JSON.stringify((await owner.readNativeAnswerExpression(transport,cfg.binding.expression_ref)).document),before);assert.equal(hash(await bounded(join(cfg.world,basis.file.location.path))),hash(fileBefore));
 checks.push('Actual wrong-person binding and changed answer refused; complete native document/file unchanged');
 const receipt=await owner.keepNativeAnswerInExpression(transport,answer,input,()=>{});
 assert.equal(receipt.state,'saved');assert.equal(receipt.already,false);
 assert.equal(receipt.file.location.ref,basis.file.location.ref);assert.equal(receipt.previous_revision,basis.document.revision);
 const saved=await owner.readNativeAnswerExpression(transport,cfg.binding.expression_ref),readings=await material.readKeptAnswers(saved.document),kept=readings.find(r=>r.record.answer_ref===receipt.answer_ref);
 assert.ok(kept);assert.equal(kept.body,answer.answer);assert.equal(kept.primary,answer.epii?.enrichment.synthesis??answer.answer);assert.equal(saved.document.revision,receipt.revision);
 assert.deepEqual(kept.record.answer_block_ids,answer.answerBlockIds);assert.deepEqual(kept.record.question_block_ids,answer.questionBlockIds);assert.equal(kept.record.question,answer.question);
 const plan=await owner.planNativeAnswerExpression(basis.document,answer,input);owner.verifyAnswerWorldConservation(basis.document,saved.document,plan.record.parts.length?{...plan.record,retained_at:kept.record.retained_at}:plan.record,plan.scenes);
 const completeScalars=value=>{for(let i=0;i<value.length;i++){const unit=value.charCodeAt(i);if(unit>=0xd800&&unit<=0xdbff){assert.ok(i+1<value.length&&value.charCodeAt(i+1)>=0xdc00&&value.charCodeAt(i+1)<=0xdfff,'Admitted title has a lone high surrogate');i++;}else assert.ok(unit<0xdc00||unit>0xdfff,'Admitted title has a lone low surrogate');}};
 const normalizedTitle=`${answer.dialogue.role==='epii'?'Epii':'Nara'} · ${Array.from(answer.question.replace(/\s+/g,' ')).slice(0,108).join('')}`;
 for(const row of plan.scenes){const actual=saved.document.scenes.find(s=>s.scene_ref===row.scene_ref);assert.ok(actual);completeScalars(actual.title);completeScalars(actual.presentation.scene.name);assert.equal(actual.title,row.title);assert.ok(actual.title===normalizedTitle||actual.title.startsWith(normalizedTitle+' · '));}
 checks.push('Actual native admitted reading titles preserve complete Unicode scalars; complete original inquiry/body unchanged');
 checks.push('Real native Keep/complete/read/save retains one complete immutable world and every original body, subject, relation, source and profile');
 const act=(await op({op:'expression_world',request:{operation:'act_inspect',act_ref:receipt.act_ref}})).act;
 assert.equal(act.phase,'completed');assert.equal(act.return_ref,receipt.answer_ref);assert.equal(act.sequence[0].kind,'edition');assert.deepEqual(act.sequence[0].edition,saved.document);assert.equal(act.sequence.length,2);
 const again=await owner.keepNativeAnswerInExpression(transport,answer,input,()=>{});assert.equal(again.already,true);assert.equal(again.revision,receipt.revision);assert.equal((await owner.readNativeAnswerExpression(transport,cfg.binding.expression_ref)).file.revision,saved.file.revision);
 const changed=structuredClone(saved.document),record=changed.scenes.find(s=>s.presentation?.scene?.epiWorld).presentation.scene.epiWorld.kept_answers.find(r=>r.answer_ref===receipt.answer_ref),first=record.parts[0],layer=changed.scenes.find(s=>s.scene_ref===first.scene_ref).presentation.scene.text.find(l=>l.id===first.layer_ids[0]);
 layer.body=(layer.body[0]==='X'?'Y':'X')+layer.body.slice(1);
 const textFor=kind=>record.parts.filter(p=>p.kind===kind).flatMap(p=>p.layer_ids.map(id=>changed.scenes.find(s=>s.scene_ref===p.scene_ref).presentation.scene.text.find(l=>l.id===id).body)).join('');
 record.primary_sha256=await material.keptAnswerDigest(textFor('primary'));record.body_sha256=await material.keptAnswerDigest(record.role==='epii'?textFor('source'):textFor('primary'));
 await assert.rejects(()=>owner.readStoredNativeAnswers(transport,changed),/immutable native answer Edition/);
 assert.deepEqual((await owner.readNativeAnswerExpression(transport,cfg.binding.expression_ref)).document,saved.document);
 checks.push('Rehashed current-document quotation copy refuses against the actual native immutable Edition; original live world/file never mutated');
 checks.push('Repeated Keep reads the existing completed native Edition without another edit, scene or provider invocation');
 // Exercise existing Keep through the actual native saved world, not a local
 // document copy. The original immutable Edition and all body bytes stay intact.
 const carrier=material.keptAnswerCarrier(saved.document).scene;
 const originalPresentation=structuredClone(carrier.presentation),tamperedPresentation=structuredClone(carrier.presentation);
 const tamperedRecord=tamperedPresentation.scene.epiWorld.kept_answers.find(r=>r.answer_ref===receipt.answer_ref);
 tamperedRecord.agent_session_ref='controlled:wrong-native-answer-session';
 assert.notEqual(tamperedRecord.agent_session_ref,kept.record.agent_session_ref);
 const expectedTampered=structuredClone(saved.document);expectedTampered.scenes.find(s=>s.scene_ref===carrier.scene_ref).presentation=tamperedPresentation;
 const legalRevisionOnly=value=>{const document=structuredClone(value);document.revision=saved.document.revision;document.scenes.find(s=>s.scene_ref===carrier.scene_ref).revision=carrier.revision;return document;};
 const readActBytes=async()=>{
  const path=join(cfg.oi_home,'desktop','expression-acts',hash(receipt.act_ref)+'.json');
  assert.equal(await realpath(path),path,'The actual live Act record must not traverse a symlink');
  const bytes=await bounded(path,4*1024*1024),stored=JSON.parse(bytes);
  assert.ok(['oi.expression-act/v1','oi.expression-act-storage/v1'].includes(stored.schema));
  assert.equal(stored.act.act_ref,receipt.act_ref);assert.equal(stored.act.expression_ref,cfg.binding.expression_ref);
  assert.equal(stored.act.revision,act.revision);assert.equal(stored.act.phase,'completed');assert.equal(stored.act.return_ref,receipt.answer_ref);
  return {path,bytes};
 };
 const immutableActBefore=await readActBytes(),actBefore=JSON.stringify(await op({op:'expression_world',request:{operation:'act_inspect',act_ref:receipt.act_ref}}));
 let primaryFailure;
 try{
  const edited=await op({op:'expression',request:{operation:'edit',expression_ref:cfg.binding.expression_ref,expected_revision:saved.document.revision,actor:'agent:native-answer-attribution-refusal-gate',changes:[{change:'scene_material_set',scene_ref:carrier.scene_ref,presentation:tamperedPresentation}]}});
  assert.equal(edited.state,'ready');assert.equal(edited.dirty,true);assert.equal(edited.document.revision,saved.document.revision+1);
  assert.deepEqual(legalRevisionOnly(edited.document),expectedTampered);
  const tamperSave=await op({op:'expression',request:{operation:'save',expression_ref:cfg.binding.expression_ref,expected_revision:edited.document.revision,location:saved.file.location,expected_file_revision:saved.file.revision,actor:'agent:native-answer-attribution-refusal-gate',actor_kind:'agent'}});
  assert.equal(tamperSave.state,'saved');assert.deepEqual(tamperSave.file.location,saved.file.location);
  const tampered=await owner.readNativeAnswerExpression(transport,cfg.binding.expression_ref);
  assert.deepEqual(legalRevisionOnly(tampered.document),expectedTampered);
  assert.equal((await material.readKeptAnswers(tampered.document)).find(r=>r.record.answer_ref===receipt.answer_ref).body,answer.answer);
  const beforeRefusal={document:JSON.stringify(tampered.document),file:await bounded(join(cfg.world,tampered.file.location.path)),act:(await readActBytes()).bytes,
   actReadback:JSON.stringify(await op({op:'expression_world',request:{operation:'act_inspect',act_ref:receipt.act_ref}})),acts:await op({op:'expression_world',request:{operation:'act_list',expression_ref:cfg.binding.expression_ref}})};
  assert.ok(beforeRefusal.act.equals(immutableActBefore.bytes));assert.equal(beforeRefusal.actReadback,actBefore);
  // The current plan and transcript still qualify. Only the stored native
  // attribution conflicts with the independently held original Edition.
  const existingPlan=await owner.planNativeAnswerExpression(tampered.document,answer,input);assert.ok(existingPlan.existing);
  const refused=await owner.keepNativeAnswerInExpression(transport,answer,input,()=>{});
  assert.equal(refused.already,true);assert.equal(refused.state,'native-kept-file-unconfirmed');assert.match(refused.error,/immutable native answer Edition/);
  const afterRefusal=await owner.readNativeAnswerExpression(transport,cfg.binding.expression_ref);
  assert.equal(JSON.stringify(afterRefusal.document),beforeRefusal.document);assert.deepEqual(afterRefusal.file,tampered.file);
  assert.ok((await bounded(join(cfg.world,tampered.file.location.path))).equals(beforeRefusal.file));
  assert.ok((await readActBytes()).bytes.equals(beforeRefusal.act));
  assert.equal(JSON.stringify(await op({op:'expression_world',request:{operation:'act_inspect',act_ref:receipt.act_ref}})),beforeRefusal.actReadback);
  assert.deepEqual(await op({op:'expression_world',request:{operation:'act_list',expression_ref:cfg.binding.expression_ref}}),beforeRefusal.acts);
  report.existing_keep_refusal={receipt:refused,document_sha256:hash(beforeRefusal.document),file:{location:tampered.file.location,revision:tampered.file.revision,bytes:beforeRefusal.file.length,sha256:hash(beforeRefusal.file)},act:{path:immutableActBefore.path,bytes:beforeRefusal.act.length,sha256:hash(beforeRefusal.act),native_readback_sha256:hash(beforeRefusal.actReadback)},actual_native_edit_revision:edited.document.revision};
  checks.push('Actually native-edited and same-file saved attribution mismatch refuses repeated Keep; exact Document/file/Act bytes and register unchanged by refusal');
 }catch(error){primaryFailure=error;}
 // Restore only the exact controlled fault (or preserve an unexpected native
 // change). This is a successor native edit and Save, never a source/store rewind.
 try{
  let current=await op({op:'expression',request:{operation:'inspect',expression_ref:cfg.binding.expression_ref}});
  const comparable=legalRevisionOnly(current.document);
  assert.ok(material.sameAnswerValue(comparable,expectedTampered)||material.sameAnswerValue(comparable,saved.document),'Unexpected concurrent native change: refuse to overwrite it during gate restoration');
  if(material.sameAnswerValue(comparable,expectedTampered)){
   current=await op({op:'expression',request:{operation:'edit',expression_ref:cfg.binding.expression_ref,expected_revision:current.document.revision,actor:'agent:native-answer-attribution-gate-restore',changes:[{change:'scene_material_set',scene_ref:carrier.scene_ref,presentation:originalPresentation}]}});
   assert.equal(current.state,'ready');assert.deepEqual(legalRevisionOnly(current.document),saved.document);
   const restored=await op({op:'expression',request:{operation:'save',expression_ref:cfg.binding.expression_ref,expected_revision:current.document.revision,location:current.file.location,expected_file_revision:current.file.revision,actor:'agent:native-answer-attribution-gate-restore',actor_kind:'agent'}});
   assert.equal(restored.state,'saved');assert.deepEqual(restored.file.location,saved.file.location);
  }
  const restored=await owner.readNativeAnswerExpression(transport,cfg.binding.expression_ref);
  assert.deepEqual(legalRevisionOnly(restored.document),saved.document);
  await owner.readStoredNativeAnswers(transport,restored.document);
  assert.ok((await readActBytes()).bytes.equals(immutableActBefore.bytes));
  assert.equal(JSON.stringify(await op({op:'expression_world',request:{operation:'act_inspect',act_ref:receipt.act_ref}})),actBefore);
  report.attribution_restore={standing:'Exact controlled material restored through ordinary native edit/same-file Save; lawful revisions advanced',revision:restored.document.revision,file:restored.file,act_sha256:hash(immutableActBefore.bytes)};
 }catch(error){report.restoration_error=String(error);if(primaryFailure)report.primary_error=String(primaryFailure);throw new AggregateError(primaryFailure?[primaryFailure,error]:[error],'Actual native attribution gate/restoration failed');}
 if(primaryFailure)throw primaryFailure;
 const finalSaved=await owner.readNativeAnswerExpression(transport,cfg.binding.expression_ref),bytes=await bounded(join(cfg.world,finalSaved.file.location.path));
 // Exercise the actual receiver on this newly completed native answer, not
 // a fixture body or supplied answer. This separate receiver writes only its
 // own regular test checkpoint; the ordinary native file/Act remain unchanged.
 const {NativeWorking}=await server.ssrLoadModule('/expressions-app/field-studies-journeys/src/nativeWorking.ts');
 const receiverCheckpoint=join(cfg.output,'actual-answer-receiver-checkpoint.json');
 const receiving=new NativeWorking({expression:request=>op({op:'expression',request}),
  file:async()=>{throw Error('This read-only receiver test does not authorise file publication');},
  checkpoint:async(_id,record)=>{await writeFile(receiverCheckpoint,JSON.stringify(record));assert.deepEqual(JSON.parse(await bounded(receiverCheckpoint)),record);},
  mint:()=>{throw Error('This receiver must use the actual acknowledged answer Expression');}});
 const attachedFile={...finalSaved.file,expression_ref:finalSaved.document.expression_ref,document_revision:finalSaved.document.revision};
 await receiving.adopt(finalSaved.document,attachedFile);
 const answerView=receiving.acknowledgedView;
 assert.deepEqual(answerView.document,finalSaved.document);assert.strictEqual(receiving.acknowledgedView,answerView);
 const assertFrozen=value=>{if(value&&typeof value==='object'){assert.equal(Object.isFrozen(value),true);for(const child of Object.values(value))assertFrozen(child);}};
 assertFrozen(answerView);
 const actualReadings=await material.readKeptAnswers(answerView.document),actualReading=actualReadings.find(r=>r.record.answer_ref===receipt.answer_ref);
 assert.ok(actualReading);assert.equal(actualReading.body,answer.answer);
 const actualEdition=await op({op:'expression_world',request:{operation:'act_inspect',act_ref:actualReading.record.act_ref}});
 assert.strictEqual(receiving.acknowledgedView,answerView,'An unchanged full answer basis survives an actual awaited native Edition read');
 await material.verifyStoredAnswerEdition(answerView.document,actualReading,actualEdition);
 assert.strictEqual(receiving.acknowledgedView,answerView);
 assert.throws(()=>{answerView.document.scenes[0].title='Caller-only unadmitted title';},TypeError);
 const receiverBefore=receiving.state,summary=receiving.inspect();
 summary.notes.push('Detached test note');summary.bindings[Object.keys(summary.bindings)[0]].member_refs.length=0;
 const caller=receiving.state;caller.view.document.title='Detached caller title';
 assert.deepEqual(receiving.state,receiverBefore);
 const returningEdition=op({op:'expression_world',request:{operation:'act_inspect',act_ref:actualReading.record.act_ref}});
 receiving.detach();assert.equal(receiving.acknowledgedView,undefined);
 await material.verifyStoredAnswerEdition(answerView.document,actualReading,await returningEdition);
 assert.notStrictEqual(receiving.acknowledgedView,answerView,'A genuine returning native read cannot restore an abandoned receiving basis');
 receiving.restore(receiverBefore,receiverBefore.view.journey);
 assert.notStrictEqual(receiving.acknowledgedView,answerView,'Even equal restoration is a new receiving lifetime for awaited-read fences');
 assert.deepEqual(receiving.acknowledgedView.document,finalSaved.document);assertFrozen(receiving.acknowledgedView);
 const receiverAfter=await owner.readNativeAnswerExpression(transport,cfg.binding.expression_ref);
 assert.deepEqual(receiverAfter,finalSaved);assert.ok((await bounded(join(cfg.world,finalSaved.file.location.path))).equals(bytes));
 assert.ok((await readActBytes()).bytes.equals(immutableActBefore.bytes));
 report.immutable_answer_receiver={document_revision:finalSaved.document.revision,answer_ref:receipt.answer_ref,
  checkpoint:{path:receiverCheckpoint,bytes:(await stat(receiverCheckpoint)).size,sha256:hash(await bounded(receiverCheckpoint))},
  scope:'Actual newly completed native answer/Edition, detached immutable NativeWorking view and regular test checkpoint; no mounted Read/Recovery-owner/restart/installed claim'};
 checks.push('Actual complete fresh answer retains unchanged awaited native read identity, refuses caller mutation and invalidates detached/restored read basis without changing native Document/file/Act');
 const finalProcessReadback=await inspectOwnedProcess();assert.deepEqual(finalProcessReadback,launchReadback);
 Object.assign(report,{standing:'passed actual native receiving only',receipt,answer,document:finalSaved.document,file:{location:finalSaved.file.location,revision:finalSaved.file.revision,bytes:bytes.length,sha256:hash(bytes)},native_process_after:finalProcessReadback,submitted_turn:{path:cfg.submitted_turn_receipt,sha256:cfg.submitted_turn_sha256},excludes:['independent new-process restart','mounted Return gesture','ordinary DOM/capture','engine/GPU/audio effects','installed/H','full256 Act-register occupancy refusal']});
}catch(error){report.standing='failed';report.error=String(error);process.exitCode=1;}
finally{try{await server.close();}catch(error){report.standing='failed';report.cleanup_error=String(error);process.exitCode=1;}await writeFile(join(cfg.output,'receipt.json'),JSON.stringify(report,null,2));}
