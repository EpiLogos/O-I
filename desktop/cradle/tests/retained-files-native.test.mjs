/** Real Central and native kernel on disposable source/home. Actual source
 * deletion and exclusion drive recovery; no substituted owner responses. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,mkdir,writeFile,readFile as readSourceBytes,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {kernelOp} from '../src/kernel/bridge.ts';
import {listFiles,readFile,lastFileReading} from '../src/files/client.ts';
import {acquireFileReading,acquireFileBytes,peekFileReading,peekFileBytes,resourceStats,invalidateFile,beginResourceOwner} from '../src/files/resources.ts';
import {qualifyDraftOwner} from '../src/workspace/drafts.ts';
import {saveDocumentPayload} from '../src/document/hostSave.ts';
import {readDocumentIdentity} from '../src/document/identity.ts';

test('native retained readings survive restart and missing branches but never bypass fresh retrieval exclusion',{skip:process.env.OI_NATIVE_RETAINED_FILES!=='1',timeout:120000},async()=>{
 for(const name of ['OI_KERNEL_BIN','OI_CENTRAL_CTRL_BIN','OI_BIN'])assert.ok(process.env[name],`${name} is required`);
 assert.ok(process.env.OI_NATIVE_TEST_ROOT,'an explicit native-test fixture field is required');await mkdir(process.env.OI_NATIVE_TEST_ROOT,{recursive:true});
 const scratch=await mkdtemp(join(process.env.OI_NATIVE_TEST_ROOT,'oi-retained-native-')),root=join(scratch,'Central'),home=join(scratch,'oi-home');let child,transport,stderr='';
 const env={...process.env,OI_HOME:home,OI_CENTRAL_ROOT:root,OI_CENTRAL_PROJECT_QUERY:''};
 const start=async()=>{child=spawn(process.env.OI_KERNEL_BIN,['127.0.0.1:0'],{env,stdio:['ignore','pipe','pipe']});child.stderr.on('data',chunk=>stderr=(stderr+chunk).slice(-65536));const url=await new Promise((resolve,reject)=>{let text='',settled=false;const timer=setTimeout(()=>reject(Error(stderr||'Native startup timed out')),30000);child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',code=>{clearTimeout(timer);reject(Error(`Native exited ${code}: ${stderr}`));});child.stdout.on('data',chunk=>{if(settled)return;text=(text+chunk).slice(-65536);const match=/listening on (http:\/\/[^ ]+)/.exec(text);if(match){settled=true;clearTimeout(timer);resolve(match[1]);}});});transport={kind:'bridge',url};};
 const stop=async()=>{if(child&&child.exitCode===null&&child.signalCode===null){const exited=once(child,'exit');let timer;const wait=async()=>{try{await Promise.race([exited,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Owned native child did not retire')),3000);})]);}finally{clearTimeout(timer);}};child.kill('SIGTERM');try{await wait();}catch{child.kill('SIGKILL');await wait();}}};
 try{
  const init=JSON.parse(execFileSync(process.env.OI_CENTRAL_CTRL_BIN,['--root',root,'--json','action','run','central.init','{}'],{env,encoding:'utf8',timeout:30000}));assert.equal(init.ok,true,JSON.stringify(init));
  const parent='Work/RetainedProof';await mkdir(join(root,parent),{recursive:true});await writeFile(join(root,parent,'reading.md'),'Native reading retained across a missing source.\n');
  await start();const listed=await listFiles(transport,parent,true);const location=listed.entries.find(row=>row.name==='reading.md').location;const reading=await readFile(transport,location);assert.equal(reading.content,'Native reading retained across a missing source.\n');
  await stop();await rm(join(root,parent),{recursive:true});await start();await assert.rejects(readFile(transport,location));
  const recovered=await lastFileReading(transport,location);assert.equal(recovered.migration_allowed,true);assert.equal(recovered.retained.reading.content,reading.content);assert.equal(recovered.retained.reading.revision,reading.revision);assert.deepEqual(recovered.retained.reading.location,location);assert.equal(recovered.retained.standing,'last-native-reading');for(const operation of ['write','history','restore'])assert.equal(recovered.retained.reading.operations[operation].available,false);
  await mkdir(join(root,parent),{recursive:true});await writeFile(join(root,parent,'.no-agent-retrieval'),'');
  const denied=await lastFileReading(transport,location);assert.equal(denied.retained,null);assert.equal(denied.migration_allowed,false,'fresh exclusion wins even after a previously allowed recovery');
  await rm(join(root,parent,'.no-agent-retrieval'));await writeFile(join(root,parent,'reading.md'),'Current source resumed.\n');const fresh=await readFile(transport,location);assert.equal(fresh.content,'Current source resumed.\n');assert.notEqual(fresh.revision,reading.revision);
  await assert.rejects(readFile(transport,{...location,root:root+'-different'}));const foreign=await lastFileReading(transport,{...location,root:root+'-different'});assert.equal(foreign.retained,null);assert.equal(foreign.migration_allowed,false);
  // The real native owner rejects this foreign root. Its consumer cache must
  // preserve that same qualification after an allowed text AND binary read.
  const cached=await acquireFileReading(transport,location);assert.equal(cached.content,fresh.content);
  const cachedBytes=await acquireFileBytes(transport,location);assert.equal(cachedBytes.location.root,location.root);
  const neighbouring={...location,root:root+'-different'};
  assert.equal(peekFileReading(transport,neighbouring),undefined,'a matching ref cannot expose another root\'s retained text');
  assert.equal(peekFileBytes(transport,neighbouring),undefined,'a matching ref cannot expose another root\'s retained bytes');
  await assert.rejects(acquireFileReading(transport,neighbouring),'text cache must not bypass the actual native root refusal');
  await assert.rejects(acquireFileBytes(transport,neighbouring),'byte cache must not bypass the actual native root refusal');
  const unqualified={...location,root:''};
  await assert.rejects(readFile(transport,unqualified),'the actual native owner requires its root qualification');
  assert.equal(peekFileReading(transport,unqualified),undefined,'an absent root is not a wildcard read');
  assert.equal(peekFileBytes(transport,unqualified),undefined,'an absent root is not a wildcard byte read');
  await assert.rejects(acquireFileReading(transport,unqualified));await assert.rejects(acquireFileBytes(transport,unqualified));
  for(const invalid of [{...location,path:location.path+'.different'},{...location,ref:location.ref+'-different'},{...location,schema:'central.path-ref/wrong'}]){
   await assert.rejects(readFile(transport,invalid),'the actual native owner rejects the incomplete or contradictory tuple');
   assert.equal(peekFileReading(transport,invalid),undefined);assert.equal(peekFileBytes(transport,invalid),undefined);
   await assert.rejects(acquireFileReading(transport,invalid));await assert.rejects(acquireFileBytes(transport,invalid));
  }
  // A restart really creates another native endpoint. Neither operation may
  // borrow the first endpoint's cache-only presentation before admission.
  await stop();await start();assert.equal(peekFileReading(transport,location),undefined);assert.equal(peekFileBytes(transport,location),undefined);
  await Promise.all([acquireFileReading(transport,location),acquireFileBytes(transport,location)]);
  await writeFile(join(root,parent,'reading.md'),'A real externally revised source.\n');
  assert.equal((await acquireFileReading(transport,location)).content,'A real externally revised source.\n');
  // This transparent relay delays a REAL native response without fabricating
  // an owner result. Its stable URL also survives a genuine kernel restart.
  const bounded=async(promise,label,milliseconds=10000)=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(`${label} timed out`)),milliseconds);})]);}finally{clearTimeout(timer);}};
  let holdNext,nativeRequests=0;const holds=new Set(),controllers=new Set();
  const holdResponse=()=>{let arrived,failed,release;const arrival=new Promise((resolve,reject)=>{arrived=resolve;failed=reject;});arrival.catch(()=>{});const gate=new Promise(resolve=>release=resolve);const held={arrival,arrived,failed,gate,release};holds.add(held);holdNext=held;return held;};
  const relay=createServer(async(req,res)=>{
   const controller=new AbortController();controllers.add(controller);let delayed;
   const deadline=setTimeout(()=>{controller.abort(Error('Actual native relay request timed out'));req.destroy();res.destroy();},10000);
   res.once('close',()=>controller.abort());
   try{
    let bytes=0;const chunks=[];
    for await(const chunk of req){bytes+=chunk.length;assert.ok(bytes<=65536,'relay request byte bound');chunks.push(chunk);}
    const body=Buffer.concat(chunks);
    if(holdNext&&JSON.parse(body.toString('utf8')).op==='file_read'){delayed=holdNext;holdNext=undefined;}
    const actual=await fetch(transport.url+req.url,{method:req.method,body,headers:{'content-type':'application/json'},signal:controller.signal});
    let responseBytes=0;const responseChunks=[];
    for await(const chunk of actual.body){responseBytes+=chunk.length;assert.ok(responseBytes<=16*1024*1024,'relay response byte bound');responseChunks.push(chunk);}
    const nativeBody=Buffer.concat(responseChunks);nativeRequests++;
    if(delayed){delayed.arrived(JSON.parse(nativeBody.toString('utf8')));await bounded(delayed.gate,'held actual native response');}
    assert.equal(controller.signal.aborted,false,'relay response remains in its request lifetime');
    res.writeHead(actual.status,{'content-type':'application/json'});res.end(nativeBody);
   }catch(error){delayed?.failed(error);controller.abort(error);if(!res.destroyed&&!res.headersSent){res.writeHead(502);res.end(JSON.stringify({ok:false,error:String(error)}));}}
   finally{clearTimeout(deadline);controllers.delete(controller);if(delayed)holds.delete(delayed);}
  });
  const relayLifetime=new AbortController();
  try{
   await bounded(new Promise((resolve,reject)=>{relay.once('error',reject);relay.listen({port:0,host:'127.0.0.1',signal:relayLifetime.signal},resolve);}), 'native relay listen');
   const stable={kind:'bridge',url:`http://127.0.0.1:${relay.address().port}`};
   // An actual native document save succeeds, then an actual delayed read
   // crosses a withdrawn foreground qualification. The second save must
   // preserve the native source, rather than relying on a disabled button.
   const pagePath='Control/user/owner-save-proof.html';await mkdir(join(root,'Control/user'),{recursive:true});
   const island={profile:'oi.page/v1',meta:{family:'vision',documentId:'native-owner-save-proof',title:'Native owner save proof',revision:1},body:'Initial native source'};
   const pageBytes=`<!doctype html><html><script type="application/json" id="ql-doc">${JSON.stringify(island)}</script></html>`;
   await writeFile(join(root,pagePath),pageBytes);
   const pageLocation=(await listFiles(transport,'Control/user',true)).entries.find(row=>row.name==='owner-save-proof.html').location;
   const page=await readFile(transport,pageLocation);
   const recognized=await kernelOp(transport,{op:'ground',request:{action:'recognize',path:root}});
   assert.equal(recognized.outcome.result,'ground_reading');
   const pageOwner=qualifyDraftOwner(root,recognized.outcome.reading);assert.ok(pageOwner);let currentPageOwner=pageOwner;
   const savedPage=await saveDocumentPayload(stable,{location:pageLocation,identity:readDocumentIdentity(page.content),basisFileRevision:page.revision,frameIslandText:JSON.stringify({...island,body:'Actually accepted native edit'}),owner:pageOwner,currentOwner:()=>currentPageOwner});
   assert.equal(savedPage.outcome.state,'saved');
   const savedBytes=await readSourceBytes(join(root,pagePath),'utf8');assert.ok(savedBytes.includes('Actually accepted native edit'));
   const pageBasis=await readFile(transport,pageLocation);
   let pageHeld=holdResponse();
   const interruptedSave=saveDocumentPayload(stable,{location:pageLocation,identity:readDocumentIdentity(pageBasis.content),basisFileRevision:pageBasis.revision,frameIslandText:JSON.stringify({...island,body:'Must stay an unaccepted page proposal'}),owner:pageOwner,currentOwner:()=>currentPageOwner});
   const actualPageReading=await bounded(pageHeld.arrival,'actual document read before qualification withdrawal');assert.equal(actualPageReading.ok,true);
   currentPageOwner=undefined;pageHeld.release();
   assert.equal((await interruptedSave).outcome.state,'refused');
   assert.equal(await readSourceBytes(join(root,pagePath),'utf8'),savedBytes,'the async qualification boundary prevents the real native document write');
   const beforeReadCount=nativeRequests;
   let held=holdResponse();
   const first=acquireFileReading(stable,location),joined=acquireFileReading(stable,location);
   // Attach rejection handlers before the deliberately delayed completion.
   const rejected=[assert.rejects(first,/file or its owner changed/),assert.rejects(joined,/file or its owner changed/)];
   const old=await bounded(held.arrival,'actual native response arrival');assert.equal(old.outcome.reading.content,'A real externally revised source.\n');
   await writeFile(join(root,parent,'reading.md'),'The revision after an actual delayed read.\n');
   const revised=await readFile(transport,location);assert.notEqual(revised.revision,old.outcome.reading.revision);
   invalidateFile(location);held.release();await Promise.all(rejected);assert.equal(nativeRequests-beforeReadCount,1,'both consumers shared the one actual native response');
   assert.equal((await acquireFileReading(stable,location)).revision,revised.revision);
   held=holdResponse();
   const prior=acquireFileReading(stable,location),afterReset=assert.rejects(prior,/file or its owner changed/);
   await bounded(held.arrival,'pre-restart native response arrival');const oldPid=child.pid;await stop();await start();assert.notEqual(child.pid,oldPid);
   const freshState=await kernelOp(stable,{op:'state'});assert.equal(freshState.outcome.result,'state');
   beginResourceOwner(stable);held.release();await afterReset;
   assert.equal(peekFileReading(stable,location),undefined,'the same relay URL cannot restore the earlier owner lifetime');
   assert.equal((await acquireFileReading(stable,location)).revision,revised.revision);
   // A real refusal is held while a later binary read receives renewed
   // native admission. Releasing the older refusal must preserve that read.
   await writeFile(join(root,parent,'.no-agent-retrieval'),'');held=holdResponse();
   const refused=acquireFileReading(stable,location),refusal=assert.rejects(refused);
   const deniedResponse=await bounded(held.arrival,'actual native refusal arrival');assert.equal(deniedResponse.ok,false);
   await rm(join(root,parent,'.no-agent-retrieval'));
   const renewed=await acquireFileBytes(stable,location);held.release();await refusal;
   assert.equal(peekFileBytes(stable,location)?.revision,renewed.revision,'an older delayed refusal cannot withdraw a later native admission');
  }finally{relayLifetime.abort();for(const held of holds){held.failed(Error('Native relay retiring'));held.release();}for(const controller of controllers)controller.abort();relay.closeAllConnections();await bounded(new Promise(resolve=>relay.close(resolve)),'native relay retirement',2000);}
  await Promise.all([acquireFileReading(transport,location),acquireFileBytes(transport,location)]);
  await writeFile(join(root,parent,'.no-agent-retrieval'),'');
  await assert.rejects(readFile(transport,location));assert.equal((await lastFileReading(transport,location)).retained,null);
  await assert.rejects(acquireFileReading(transport,location),'a resident text read cannot renew withdrawn retrieval');
  assert.equal(peekFileBytes(transport,location),undefined,'the first owner refusal also withdraws resident binary presentation');
  await assert.rejects(acquireFileBytes(transport,location),'resident bytes cannot renew withdrawn retrieval');
  assert.equal(peekFileReading(transport,location),undefined);assert.equal(peekFileBytes(transport,location),undefined);
  await rm(join(root,parent,'.no-agent-retrieval'));
  // Actual source visits must not leave an unbounded payload archive in the
  // renderer. Eviction changes presentation retention, never source content.
  for(let index=0;index<40;index++)await writeFile(join(root,parent,`visit-${index}.md`),`Native visit ${index}\n`+'x'.repeat(512*1024));
  const visits=(await listFiles(transport,parent,true)).entries.filter(row=>row.name.startsWith('visit-')).sort((a,b)=>a.name.localeCompare(b.name));
  for(const visit of visits)await acquireFileReading(transport,visit.location);
  assert.equal(peekFileReading(transport,visits[0].location),undefined,'an old actual visit is evicted from presentation');
  assert.ok(peekFileReading(transport,visits.at(-1).location),'the most recent actual visit remains readable');
  assert.ok(resourceStats().resident_entries<=64);assert.ok(resourceStats().retained_payload_bytes<=32*1024*1024);
  assert.equal((await readFile(transport,visits[0].location)).content.startsWith('Native visit '),true,'presentation eviction did not delete the native file');
 }finally{await stop();await rm(scratch,{recursive:true,force:true});}
});
