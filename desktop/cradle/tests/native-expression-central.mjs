/** Actual native owner setup for isolated Expression acceptance. */
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {access} from 'node:fs/promises';
import {constants,createReadStream} from 'node:fs';
import {isAbsolute,join} from 'node:path';
import {createHash} from 'node:crypto';

const execute=promisify(execFile);
// Retire independent owned resources concurrently: an HTTP drain must never
// prevent the native process from reaching its bounded kill/reap path.
export async function retireNativeBrowserOwners({bridge,browser,server,proxyAbort}){
 proxyAbort?.abort(new Error('Owned native proxy is shutting down'));
 const bounded=async(label,operation)=>{
  let timer;
  try{return await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{
   timer=setTimeout(()=>reject(new Error(`${label} cleanup did not settle within 3 seconds; ownership remains unknown`)),3000);
  })]);}finally{clearTimeout(timer);}
 };
 const tasks=[['bridge',()=>releaseNativeBridge(bridge)],['browser',()=>browser?.close()],['server',()=>{
  if(!server?.listening)return;
  const closed=new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  server.closeAllConnections();
  return closed;
 }]];
 const results=await Promise.allSettled(tasks.map(([label,operation])=>bounded(label,operation)));
 return Object.fromEntries(results.map((result,index)=>[tasks[index][0],result.status==='fulfilled'
  ?{ok:true,receipt:result.value??null}:{ok:false,error:String(result.reason)}]));
}
export async function releaseNativeBridge(child){
 if(!child?.pid)return {started:false};
 if(child.exitCode!==null||child.signalCode!==null)return {exit_code:child.exitCode,signal:child.signalCode};
 return new Promise((resolve,reject)=>{
  let force,deadline;
  const finished=(code,signal)=>{clearTimeout(force);clearTimeout(deadline);resolve({exit_code:code,signal});};
  child.once('exit',finished);
  child.kill('SIGTERM');
  force=setTimeout(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');},1000);
  deadline=setTimeout(()=>{child.removeListener('exit',finished);reject(new Error('Owned native bridge exit was not observed within its cleanup deadline'));},2000);
 });
}
export async function nativeCentralWorld(root){
 const owners={suite:process.env.OI_BIN,central:process.env.OI_CENTRAL_CTRL_BIN};
 const sources={};
 for(const [name,path] of Object.entries(owners)){
  assert.ok(path&&isAbsolute(path),`Explicit absolute built ${name} owner required`);
  await access(path,constants.X_OK);
  const hash=createHash('sha256');
  for await(const chunk of createReadStream(path))hash.update(chunk);
  sources[name]={path,sha256:hash.digest('hex')};
 }
 const env={...process.env,OI_BIN:owners.suite,OI_CENTRAL_CTRL_BIN:owners.central,
  CENTRAL_CTRL_BIN:owners.central,CENTRAL_ROOT:root,OI_CENTRAL_ROOT:root,
  OI_CENTRAL_PROJECT_QUERY:'',OI_HOME:join(root,'.oi-test')};
 delete env.CENTRAL_NATIVE_TOKEN;
 delete env.AIKIT_CONTEXT_ID;
 delete env.AIKIT_ISOLATION;
 const {stdout}=await execute(owners.central,['--json','--root',root,'action','run','central.init','{}'],
  {env,timeout:20000,maxBuffer:1024*1024});
 const receipt=JSON.parse(stdout);
 assert.equal(receipt.ok,true,stdout);
 assert.equal(receipt.status,'success',stdout);
 assert.ok(Object.hasOwn(receipt,'data'),'Central initialization omitted its native result');
 return {env,sources,initialization:receipt};
}
