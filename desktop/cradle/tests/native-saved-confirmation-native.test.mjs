/** Actual complete retained Epi Document, native file admission and production
 * NativeWorking reads/saves in an owned disposable Central World. No owner
 * response is substituted. Holding a real completed reply tests late delivery. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {kernelOp} from '../src/kernel/bridge.ts';
import {hostedCompositionFile} from '../src/expressions/hostedComposition.ts';
const enabled=process.env.OI_NATIVE_SAVED_CONFIRMATION==='1';
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
test('complete real Epi saved confirmation reads without writes and preserves dirty, foreign and late work',{skip:!enabled,timeout:180000},async()=>{
 for(const key of ['OI_KERNEL_BIN','OI_BIN','OI_CENTRAL_CTRL_BIN'])assert.ok(process.env[key],key+' required');
 const built=await build({stdin:{contents:"export {NativeWorking,nativeOwnerSnapshot} from './nativeWorking.ts';",resolveDir:fileURLToPath(new URL('../expressions-app/field-studies-journeys/src/',import.meta.url)),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
 const {NativeWorking,nativeOwnerSnapshot}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
 const scratch=await mkdtemp(join(tmpdir(),'oi-saved-confirmation-')),root=join(scratch,'Central'),home=join(scratch,'oi-home');
 const env={...process.env,OI_HOME:home,OI_DATA_HOME:join(scratch,'oi-data'),OI_CENTRAL_ROOT:root,OI_CENTRAL_PROJECT_QUERY:'controlled-no-project',AIKIT_HOME:join(scratch,'aikit-home')};
 let child,stderr='',gate;
 try{
  const init=JSON.parse(execFileSync(env.OI_CENTRAL_CTRL_BIN,['--root',root,'--json','action','run','central.init','{}'],{env,encoding:'utf8',timeout:30000}));assert.equal(init.ok,true,JSON.stringify(init));
  const relative='Work/Confirmation/epi.expression.json';await mkdir(join(root,'Work/Confirmation'),{recursive:true});
  // Exact declared historical full131 input; first admission is not a claimed save.
  const imported=await readFile(new URL('../kernel/tests/fixtures/epi-world-131.expression.json',import.meta.url));await writeFile(join(root,relative),imported);
  child=spawn(env.OI_KERNEL_BIN,['127.0.0.1:0'],{env,detached:true,stdio:['ignore','pipe','pipe']});child.stderr.on('data',bytes=>stderr+=bytes);
  const url=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(Error(stderr||'Native bridge startup timed out')),30000);child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',code=>{clearTimeout(timer);reject(Error('Native bridge exited '+code+stderr));});child.stdout.on('data',bytes=>{text+=bytes;const match=/listening on (http:\/\/\S+)/.exec(text);if(match){clearTimeout(timer);resolve(match[1]);}});});
  let transport={kind:'bridge',url};const requests=[];
  const operation=async(op,request)=>{const reply=await kernelOp(transport,{op,request});assert.equal(reply.error,undefined,reply.error);assert.equal(reply.outcome?.result,op);return reply.outcome.data;};
  const expression=async request=>{
   requests.push(request.operation);const reply=await operation('expression',request);
   if(gate?.operation===request.operation){const hold=gate;hold.entered.resolve();await hold.release.promise;}
   return reply;
  };
  let writes=0;
  const checkpoint=async(id,value)=>{const old=await operation('expression_recovery',{operation:'read',scope:'expressions',kind:'checkpoint',id});const saved=await operation('expression_recovery',{operation:'write',scope:'expressions',kind:'checkpoint',id,expected_revision:old.record?.revision??null,value});assert.equal(saved.state,'written');writes++;};
  const work=new NativeWorking({expression,checkpoint,file:request=>hostedCompositionFile(transport,request),mint:()=>assert.fail('A saved basis cannot mint another Expression')});
  const opened=await hostedCompositionFile(transport,{operation:'open',path:relative}),reference=opened.document.expression_ref;
  const head=nativeOwnerSnapshot(await expression({operation:'inspect',expression_ref:reference}),reference);
  assert.deepEqual(head.document,opened.document);assert.deepEqual(head.document.scenes.map(s=>s.entity_refs.length),[32,9,7]);
  let view=await work.adopt(head.document,head.file);
  const position=()=>{const entry=Object.entries(view.bindings).find(([,b])=>b.scene_ref===view.document.selection.scene_ref);assert.ok(entry);return {journey:structuredClone(view.journey),sceneId:entry[0],entityId:view.document.selection.entity_ref?entry[1].occurrences.find(o=>o.entity_ref===view.document.selection.entity_ref)?.view_entity_id??null:null};};
  let snapshot=position(),accepted=true;
  const before=await readFile(join(root,relative)),originalRecord=work.state;
  const retainedBefore=await operation('expression_recovery',{operation:'find_checkpoint',scope:'expressions',expression_ref:reference});
  requests.length=0;const writesBefore=writes;
  const confirmed=await work.confirmSaved(snapshot,()=>accepted);
  assert.deepEqual(confirmed,head.file);assert.deepEqual(requests,['inspect_file','inspect']);assert.equal(writes,writesBefore);
  assert.deepEqual(work.state,originalRecord);assert.deepEqual(await readFile(join(root,relative)),before);
  const retainedAfter=await operation('expression_recovery',{operation:'find_checkpoint',scope:'expressions',expression_ref:reference});assert.deepEqual(retainedAfter,retainedBefore,'confirmation does not rewrite complete recovery/CAS');
  const local=structuredClone(snapshot);local.journey.name+=' · unsaved local concern';requests.length=0;
  assert.equal(await work.confirmSaved(local),undefined);assert.deepEqual(requests,[]);assert.deepEqual(work.state,originalRecord);
  // A real native material edit is normally newer than its attached saved file.
  const cosmic=view.document.scenes[0],presentation=structuredClone(cosmic.presentation);
  for(const material of [presentation.scene,presentation.saved])material.text[0].body+=' Actual native saved-file regression.';
  const prior=view.document,changed=await work.editConnections([{change:'scene_material_set',scene_ref:cosmic.scene_ref,presentation}]);
  view=changed;snapshot=position();const expected=structuredClone(prior);expected.revision++;const expectedScene=expected.scenes.find(s=>s.scene_ref===cosmic.scene_ref);expectedScene.revision=expected.revision;expectedScene.presentation=presentation;assert.deepEqual(view.document,expected);
  requests.length=0;assert.equal(await work.confirmSaved(snapshot),undefined);assert.deepEqual(requests,[],'normal dirty owner edit reaches original Save without an old-file mismatch refusal');
  const saved=await work.saveFile(snapshot,{location:head.file.location,revision:head.file.revision});view=work.state.view;snapshot=position();
  assert.deepEqual(await work.confirmSaved(snapshot),saved);const actualSaved=await readFile(join(root,relative));assert.notDeepEqual(actualSaved,before);
  const inspectSaved=await expression({operation:'inspect_file',location:saved.location,expected_file_revision:saved.revision});assert.deepEqual(inspectSaved.document,expected);
  // Hold only the actual successful file read, then invalidate local admission.
  gate={operation:'inspect_file',entered:deferred(),release:deferred()};const pending=work.confirmSaved(snapshot,()=>accepted);const refused=assert.rejects(pending,/selected work changed/);await gate.entered.promise;accepted=false;gate.release.resolve();await refused;gate=undefined;accepted=true;
  assert.deepEqual(work.state.view.document,expected);assert.deepEqual(await readFile(join(root,relative)),actualSaved);
  // A genuine independent native edit after the real file read must be refused.
  gate={operation:'inspect_file',entered:deferred(),release:deferred()};const drift=work.confirmSaved(snapshot);const stale=assert.rejects(drift,/native head or file binding changed/);await gate.entered.promise;
  const other=await operation('expression',{operation:'edit',expression_ref:reference,expected_revision:expected.revision,actor:'human:independent-confirmation-regression',changes:[{change:'rename',title:expected.title+' · independent native edit'}]});assert.equal(other.state,'ready');gate.release.resolve();await stale;gate=undefined;
  assert.deepEqual(work.state.view.document,expected);assert.deepEqual(await readFile(join(root,relative)),actualSaved);
  // A genuinely fresh owner re-admits the saved basis; the independent newer
  // live head is never overwritten or used to qualify the file-replacement trial.
  const exited=once(child,'exit');process.kill(-child.pid,'SIGTERM');await exited;
  child=spawn(env.OI_KERNEL_BIN,['127.0.0.1:0'],{env,detached:true,stdio:['ignore','pipe','pipe']});child.stderr.on('data',bytes=>stderr+=bytes);
  const freshUrl=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(Error('Fresh owner startup timed out')),30000);child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',code=>{clearTimeout(timer);reject(Error('Fresh owner exited '+code+stderr));});child.stdout.on('data',bytes=>{text+=bytes;const match=/listening on (http:\/\/\S+)/.exec(text);if(match){clearTimeout(timer);resolve(match[1]);}});});
  transport={kind:'bridge',url:freshUrl};
  // Use the actual saved checkpoint before any file open primes the fresh
  // owner's binding. A plain Document open leaves that binding absent.
  const coldRecord=work.state,coldWrites=writes,coldFile=await readFile(join(root,relative));
  requests.length=0;
  const coldView=await work.reopenCheckpoint(coldRecord,snapshot.journey,()=>accepted);
  assert.deepEqual(requests,['inspect_file','open_file']);assert.deepEqual(coldView.document,expected);
  assert.deepEqual(work.state,coldRecord);assert.equal(writes,coldWrites);assert.deepEqual(await readFile(join(root,relative)),coldFile);
  const coldHeadReply=await expression({operation:'inspect',expression_ref:reference}),coldHead=nativeOwnerSnapshot(coldHeadReply,reference);
  assert.deepEqual(coldHead.document,expected);assert.deepEqual(coldHead.file,saved);assert.equal(coldHeadReply.dirty,false);assert.equal(coldHeadReply.saved_revision,expected.revision);
  // Delay only the completed real file read. A newer local admission must
  // refuse before dispatching OpenFile and preserve the old complete record.
  requests.length=0;gate={operation:'inspect_file',entered:deferred(),release:deferred()};
  const lateReopen=work.reopenCheckpoint(coldRecord,snapshot.journey,()=>accepted);
  const lateReopenRefused=assert.rejects(lateReopen,/selected draft changed/);await gate.entered.promise;accepted=false;gate.release.resolve();await lateReopenRefused;gate=undefined;accepted=true;
  assert.deepEqual(requests,['inspect_file']);assert.deepEqual(work.state,coldRecord);assert.equal(writes,coldWrites);assert.deepEqual(await readFile(join(root,relative)),coldFile);
  const reopened=await hostedCompositionFile(transport,{operation:'open',path:relative});assert.deepEqual(reopened.document,expected);
  assert.deepEqual(await work.confirmSaved(snapshot),saved);
  // Physical external replacement retains real revision conflict semantics.
  await writeFile(join(root,relative),before);await assert.rejects(work.confirmSaved(snapshot),/addressed Expression|revision_conflict|saved file/);assert.deepEqual(work.state.view.document,expected);assert.deepEqual(await readFile(join(root,relative)),before);
  requests.length=0;const unchangedRecovery=work.state;
  await assert.rejects(work.reopenCheckpoint(unchangedRecovery,snapshot.journey),/owner did not return|revision_conflict|saved recovery file/);
  assert.deepEqual(requests,['inspect_file']);assert.deepEqual(work.state,unchangedRecovery);assert.deepEqual(await readFile(join(root,relative)),before);
  assert.deepEqual(nativeOwnerSnapshot(await expression({operation:'inspect',expression_ref:reference}),reference).document,expected);
  console.log(JSON.stringify({full_document_scene_bodies:[32,9,7],confirmed_file_reads:2,confirmation_writes:0,complete_material_edit_saved:true,local_dirty_retained:true,late_local_refused:true,real_head_drift_refused:true,real_file_replacement_refused:true,scope:'Actual native generic file/working confirmation; no personal-current computation, ordinary browser, installed, GPU or H proof'}));
 }finally{
  if(gate)gate.release.resolve();
  if(child&&child.exitCode===null){const stopped=once(child,'exit');try{process.kill(-child.pid,'SIGTERM');}catch{}await stopped;}
  await rm(scratch,{recursive:true,force:true});
 }
});
