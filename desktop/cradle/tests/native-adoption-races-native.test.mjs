/** Exercise the production adoption guard and NativeWorking with real native
 * replies. Replies are held only AFTER the owner operation finishes, so the
 * test can change the selected draft before that exact result is delivered. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {kernelOp} from '../src/kernel/bridge.ts';

const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
test('real native adoption and recovery replies cannot replace newer edits or a later selected basis',{
 skip:process.env.OI_NATIVE_EXPRESSION_RECOVERY!=='1'?'Set OI_NATIVE_EXPRESSION_RECOVERY=1 with a rebuilt native bridge':false,timeout:120000,
},async()=>{
 assert.ok(process.env.OI_KERNEL_BIN,'OI_KERNEL_BIN must name the candidate walk-bridge');
 const {build}=await import('esbuild');
 const built=await build({stdin:{contents:"export {NativeWorking} from './nativeWorking.ts'; export {captureNativeAdoption} from './nativeWorkspace.ts'; export {NativeOpenIntent} from './nativeOpenIntent.ts';",resolveDir:fileURLToPath(new URL('../expressions-app/field-studies-journeys/src/',import.meta.url)),sourcefile:'native-adoption-entry.ts',loader:'ts'},bundle:true,platform:'node',format:'esm',target:'node22',write:false,logLevel:'silent'});
 const {NativeWorking,captureNativeAdoption,NativeOpenIntent}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
 const home=await mkdtemp(join(tmpdir(),'oi-native-adoption-'));
 const child=spawn(process.env.OI_KERNEL_BIN,['127.0.0.1:0'],{env:{...process.env,OI_HOME:home},detached:true,stdio:['ignore','pipe','pipe']});
 let stderr='';child.stderr.on('data',chunk=>{stderr+=chunk;});
 let gate;
 try{
  const url=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error(`Native startup timed out: ${stderr}`)),30000);child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',code=>{clearTimeout(timer);reject(Error(`Native bridge exited ${code}: ${stderr}`));});child.stdout.on('data',chunk=>{output+=chunk;const match=/listening on (http:\/\/[^ ]+)/.exec(output);if(match){clearTimeout(timer);resolve(match[1]);}});});
  const operation=async(op,request)=>{const reply=await kernelOp({kind:'bridge',url},{op,request});assert.equal(reply.error,undefined,reply.error);assert.equal(reply.outcome?.result,op);return reply.outcome.data;};
  const checkpoint=async(id,value)=>{
   const read=await operation('expression_recovery',{operation:'read',scope:'expressions',kind:'checkpoint',id});
   const written=await operation('expression_recovery',{operation:'write',scope:'expressions',kind:'checkpoint',id,expected_revision:read.record?.revision??null,value});
   assert.equal(written.state,'written');
   if(gate?.kind==='checkpoint'&&value.view?.document.expression_ref===gate.reference){const hold=gate;hold.entered.resolve();await hold.release.promise;}
  };
  const expression=async(request)=>{
   const reply=await operation('expression',request);
   if(gate?.kind==='expression'&&request.expression_ref===undefined&&request.document?.expression_ref===gate.reference){const hold=gate;hold.entered.resolve();await hold.release.promise;}
   return reply;
  };
  const working=()=>new NativeWorking({expression,checkpoint,file:async()=>{assert.fail('Adoption must not publish a native file');},mint:()=>{assert.fail('Opening native work must not mint an identity');}});
  const rows=[];
  for(const name of ['A','B','C']){
   const reply=await expression({operation:'create',expression_ref:`expression:adoption-${name}`,title:`Native work ${name}`,actor:'human:native-adoption-test'});
   const owner=working(),view=await owner.adopt(reply.document);rows.push({document:reply.document,record:owner.state,view});
  }
  const [a,b,c]=rows;
  const work=working();work.restore(a.record,a.view.journey);
  let snapshot={journey:structuredClone(a.view.journey),sceneId:a.view.journey.scenes[0].id,entityId:null},version=1,generation=1;
  const host={snapshot:()=>structuredClone(snapshot),version:()=>version};
  const hold=kind=>{gate={kind,reference:b.document.expression_ref,entered:deferred(),release:deferred()};return gate;};
  const select=row=>{generation++;version++;snapshot={journey:structuredClone(row.view.journey),sceneId:row.view.journey.scenes[0].id,entityId:null};work.detach();work.restore(row.record,snapshot.journey);};
  for(const method of ['adopt','reopen']){
   select(a);
   const waiting=hold(method==='adopt'?'checkpoint':'expression');
   const current=captureNativeAdoption(host,()=>generation);
   const returned=method==='adopt'?work.adopt(b.document,undefined,current):work.reopenCheckpoint(b.record,b.view.journey,current);
   const refused=assert.rejects(returned,/selected draft changed/);
   await waiting.entered.promise;
   snapshot.journey.name=`Newer local edit during ${method}`;version++;
   waiting.release.resolve();await refused;gate=undefined;
   assert.equal(work.state.view.document.expression_ref,a.document.expression_ref,'a newer edit retains its original native basis');
   assert.equal(snapshot.journey.id,a.view.journey.id);
   assert.equal(snapshot.journey.name,`Newer local edit during ${method}`);

   select(a);
   const navigation=hold(method==='adopt'?'checkpoint':'expression');
   const selected=captureNativeAdoption(host,()=>generation);
   const late=method==='adopt'?work.adopt(b.document,undefined,selected):work.reopenCheckpoint(b.record,b.view.journey,selected);
   const stale=assert.rejects(late,/selected draft changed/);
   await navigation.entered.promise;select(c);const selectedBasis=work.state;navigation.release.resolve();await stale;gate=undefined;
   assert.deepEqual(work.state,selectedBasis,'a late result never rolls back the basis selected by a later navigation');
   assert.equal(snapshot.journey.id,c.view.journey.id);
   assert.deepEqual((await expression({operation:'inspect',expression_ref:b.document.expression_ref})).document,b.document,'rejected adoption neither rewrites nor deletes the native work it read');
  }
  select(a);
  const accepted=await work.reopenCheckpoint(b.record,b.view.journey,captureNativeAdoption(host,()=>generation));
  assert.equal(accepted.document.expression_ref,b.document.expression_ref,'an unchanged selected draft can adopt the exact returned basis');
  assert.equal(work.state.view.document.expression_ref,b.document.expression_ref);
  const authoredRef='expression:original-authored-recovery';
  const authored=structuredClone(a.view.journey);authored.id='original-authoring-journey';authored.name='Original authored identity';
  const author=new NativeWorking({expression,checkpoint,file:async()=>{assert.fail('Commit must not publish a native file');},mint:()=>authoredRef});
  await author.commit({journey:authored,sceneId:authored.scenes[0].id,entityId:null});
  const retained=await operation('expression_recovery',{operation:'find_checkpoint',scope:'expressions',expression_ref:authoredRef});
  assert.equal(retained.record.id,authored.id,'first native commit keeps the actual authored Journey identity');
  assert.ok((await expression({operation:'list'})).expressions.some(row=>row.expression_ref===authoredRef),'the actual native owner already has this work open');
  const continuing=working();
  const reopened=await continuing.reopenCheckpoint(retained.record.value,authored);
  assert.equal(reopened.journey.id,authored.id,'live reopen uses the checkpoint identity rather than a new ref-derived Journey id');
  assert.equal(continuing.state.draft_id,authored.id);
  const unchanged=await operation('expression_recovery',{operation:'find_checkpoint',scope:'expressions',expression_ref:authoredRef});
  assert.equal(unchanged.record.id,authored.id,'reopen introduces no duplicate checkpoint');
  assert.equal(unchanged.record.revision,retained.record.revision,'reading a live checkpoint does not rewrite it');

  // The production open-intent queue waits behind an existing owner task,
  // retains a failed read delivery, and retries only on the explicit act.
  const waitingOwner=deferred(),retryWork=working();let idle=waitingOwner.promise,failDelivery=false,invalidateAfterAdoption=false,attempts=0,adopted;
  const current=()=>version===41;version=41;
  const intents=new NativeOpenIntent({idle:()=>idle,changed:()=>{},open:async(reference,accept)=>{
   attempts++;
   const read=await operation('expression_recovery',{operation:'find_checkpoint',scope:'expressions',expression_ref:reference});
   assert.equal(read.state,'ready');assert.ok(read.record);
   // Lose this real read's delivery, without fabricating an owner response
   // or dispatching a native mutation. No automatic retry is authorized.
   if(failDelivery){failDelivery=false;return false;}
   const view=await retryWork.reopenCheckpoint(read.record.value,read.record.value.view.journey,accept);
   if(!accept())return false;adopted=view;if(invalidateAfterAdoption){version++;void intents.reference;}return true;
  }});
  const first=intents.submit(a.document.expression_ref,current),latest=intents.submit(b.document.expression_ref,current);
  assert.equal(await first,false,'new navigation replaces an undispatched intent');assert.equal(attempts,0,'owner busy means the open waits, not drops');
  waitingOwner.resolve();assert.equal(await latest,true);assert.equal(adopted.document.expression_ref,b.document.expression_ref);assert.equal(intents.reference,undefined);
  idle=Promise.resolve();failDelivery=true;
  assert.equal(await intents.submit(c.document.expression_ref,current),false);assert.equal(intents.reference,c.document.expression_ref);const afterFailure=attempts;
  await new Promise(resolve=>setImmediate(resolve));assert.equal(attempts,afterFailure,'failed delivery does not replay any owner operation automatically');
  assert.equal(await intents.retry(),true);assert.equal(adopted.document.expression_ref,c.document.expression_ref);assert.equal(intents.reference,undefined);
  invalidateAfterAdoption=true;assert.equal(await intents.submit(a.document.expression_ref,current),true,'view refresh during acknowledged adoption cannot turn successful opening into failure');invalidateAfterAdoption=false;version=41;
  const editWait=deferred();idle=editWait.promise;const cancelled=intents.submit(a.document.expression_ref,current);version++;editWait.resolve();assert.equal(await cancelled,false);assert.equal(adopted.document.expression_ref,a.document.expression_ref,'a local edit cancels queued adoption');

 }finally{
  gate?.release.resolve();
  if(child.exitCode===null){const stopped=once(child,'exit');try{process.kill(-child.pid,'SIGTERM');}catch{}await stopped;}
  await rm(home,{recursive:true,force:true});
 }
});
