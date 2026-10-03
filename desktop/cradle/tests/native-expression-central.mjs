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
export async function retireNativeBrowserOwners({bridge,browser,browserOwner,server,proxyAbort}){
 proxyAbort?.abort(new Error('Owned native proxy is shutting down'));
 const bounded=async(label,operation,milliseconds=3000)=>{
  let timer;
  try{return await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{
   timer=setTimeout(()=>reject(new Error(`${label} cleanup did not settle within ${milliseconds} ms; ownership remains unknown`)),milliseconds);
  })]);}finally{clearTimeout(timer);}
 };
 const tasks=[['bridge',()=>releaseNativeBridge(bridge)],['browser',()=>releaseOwnedBrowser(browser,browserOwner),9000],['server',()=>{
  if(!server?.listening)return;
  const closed=new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  server.closeAllConnections();
  return closed;
 }]];
 const results=await Promise.allSettled(tasks.map(([label,operation,milliseconds])=>bounded(label,operation,milliseconds)));
 return Object.fromEntries(results.map((result,index)=>[tasks[index][0],result.status==='fulfilled'
  ?{ok:true,receipt:result.value??null}:{ok:false,error:String(result.reason)}]));
}
/** A launchServer supplies actual process custody. A client-close deadline
 * alone cannot retire a browser whose GPU or page is no longer responding. */
export async function releaseOwnedBrowser(browser,owner){
 if(!owner){await browser?.close();return null;}
 const child=owner.process();
 assert.ok(child?.pid,'Owned browser has no actual child identity');
 const exited=()=>child.exitCode!==null||child.signalCode!==null;
 const receipt={owned_pid:child.pid,forced:false};
 const bounded=async(operation,milliseconds)=>{
  let timer;
  try{return await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{
   timer=setTimeout(()=>reject(new Error('Owned browser retirement deadline reached')),milliseconds);
  })]);}finally{clearTimeout(timer);}
 };
 if(!exited()){
  try{await bounded(()=>Promise.all([browser?.close(),owner.close()]),2000);}
  catch(error){
   receipt.graceful_failure=String(error);
   if(!exited()){receipt.forced=true;await bounded(()=>owner.kill(),5000);}
  }
 }
 assert.ok(exited(),'Owned browser process exit was not observed; ownership remains unknown');
 return {...receipt,exit_code:child.exitCode,signal:child.signalCode};
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
