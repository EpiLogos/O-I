/** Actual Central/oi/kernel fixture for the production editor walk.
 * Binaries must be supplied by the caller's recorded native build. This
 * helper never installs, builds, or substitutes an owner on a person's Mac.
 */
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

export async function startCanvasNativeOwner(output,initialSource,initialFlow){
 for(const key of ['OI_BIN','OI_CENTRAL_CTRL_BIN','OI_KERNEL_BIN'])assert.ok(process.env[key],`${key}: the recorded native build is required; no invented recognition or file response`);
 const scratch=mkdtempSync(join(output,'native-owner-')),root=join(scratch,'Central'),home=join(scratch,'oi-home');
 const env={...process.env,OI_HOME:home,OI_CENTRAL_ROOT:root,OI_CENTRAL_PROJECT_QUERY:''};
 const native=(action,input)=>{const result=JSON.parse(execFileSync(env.OI_CENTRAL_CTRL_BIN,['--root',root,'--json','action','run',action,JSON.stringify(input)],{env,encoding:'utf8',timeout:30000,maxBuffer:1024*1024}));assert.equal(result.ok,true,JSON.stringify(result));return result.data;};
 const samplePath=join(root,'Control/user/sample.md'),flowPath=join(root,'Control/user/flow.html');
 let child,closed=false,closedPromise,spawnFailure,stderr='';
 const bounded=async(promise,label)=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label)),3000);})]);}finally{clearTimeout(timer);}};
 const retire=async()=>{
  try{
   if(child&&!closed){
    if(child.pid)child.kill('SIGTERM');
    try{await bounded(closedPromise,'Owned native editor fixture did not close');}
    catch{if(child.pid)child.kill('SIGKILL');await bounded(closedPromise,'Owned native editor fixture did not close after hard retirement');}
   }
  }finally{
   writeFileSync(join(output,'native-owner-retirement.json'),JSON.stringify({pid:child?.pid??null,exit_code:child?.exitCode??null,signal:child?.signalCode??null,spawn_failure:spawnFailure??null,direct_child_closed:closed,no_process_spawned:!child,scratch_preserved:!!child&&!closed,scratch},null,2));
   if(!child||closed)rmSync(scratch,{recursive:true,force:true});
  }
 };
 try{
  // A disposable native world never inherits the person's native grant or
  // agent context; only the supplied test binaries and fixture root act.
  delete env.CENTRAL_NATIVE_TOKEN;delete env.AIKIT_CONTEXT_ID;delete env.AIKIT_ISOLATION;
  env.CENTRAL_ROOT=root;env.CENTRAL_CTRL_BIN=env.OI_CENTRAL_CTRL_BIN;
  native('central.init',{});mkdirSync(join(root,'Control/user'),{recursive:true});
  writeFileSync(samplePath,initialSource);writeFileSync(flowPath,initialFlow);
  child=spawn(env.OI_KERNEL_BIN,['127.0.0.1:0'],{env,stdio:['ignore','pipe','pipe']});
  closedPromise=new Promise(resolve=>child.once('close',()=>{closed=true;resolve();}));
  child.once('error',error=>{spawnFailure=String(error);});
  child.stderr.on('data',bytes=>{stderr=(stderr+bytes).slice(-65536);});
  const url=await new Promise((resolve,reject)=>{let text='',settled=false;const timer=setTimeout(()=>reject(Error(stderr||'Native editor owner startup timed out')),30000);child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',code=>{clearTimeout(timer);reject(Error(`Native editor owner exited ${code}: ${stderr}`));});child.stdout.on('data',bytes=>{if(settled)return;text=(text+bytes).slice(-65536);const match=/listening on (http:\/\/[^ ]+)/.exec(text);if(match){settled=true;clearTimeout(timer);resolve(match[1]);}});});
  const operation=async op=>{const response=await fetch(url+'/op',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(op),signal:AbortSignal.timeout(10000)});const result=await response.json();assert.equal(result.ok,true,JSON.stringify(result));return result.outcome;};
  const listed=await operation({op:'files_list',path:'Control/user',fresh:true});
  assert.equal(listed.result,'directory_read');
  const entries=listed.directory.entries;
  const sample=entries.find(row=>row.name==='sample.md')?.location,flow=entries.find(row=>row.name==='flow.html')?.location;assert.ok(sample);assert.ok(flow);
  const flowReading=await operation({op:'file_read',location:flow});assert.equal(flowReading.result,'file_read');
  const recognition=native('central.recognize',{path:root});
  writeFileSync(join(output,'native-owner-basis.json'),JSON.stringify({root,recognition,binaries:Object.fromEntries(['OI_BIN','OI_CENTRAL_CTRL_BIN','OI_KERNEL_BIN'].map(key=>[key,{path:env[key],sha256:createHash('sha256').update(readFileSync(env[key])).digest('hex')}])),sample,flow,flow_revision:flowReading.reading.revision},null,2));
  return {root,sample,flow,flowRevision:flowReading.reading.revision,flowBytes:()=>readFileSync(flowPath,'utf8'),sourceBytes:()=>readFileSync(samplePath,'utf8'),url,retire};
 }catch(error){try{await retire();}catch(cleanup){throw new AggregateError([error,cleanup],'Native editor fixture failed and could not retire');}throw error;}
}
