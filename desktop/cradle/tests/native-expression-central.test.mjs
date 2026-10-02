/** Real HTTP/process cleanup; no fabricated native owner response. */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {retireNativeBrowserOwners} from './native-expression-central.mjs';

test('owned proxy shutdown aborts a stalled exchange and observes native bridge retirement', {timeout:15000}, async()=>{
 const proxyAbort=new AbortController();
 const bounded=async(label,promise)=>{
  let timer;
  try{return await Promise.race([promise,new Promise((_,reject)=>{
   timer=setTimeout(()=>reject(new Error(`${label} did not settle within 3 seconds`)),3000);
  })]);}finally{clearTimeout(timer);}
 };
 let entered,finished,proxyAborted=false;
 const receiving=new Promise(resolve=>{entered=resolve;});
 const proxyStopped=new Promise(resolve=>{finished=resolve;});
 const upstream=createServer(()=>entered()); // Real peer deliberately withholds its HTTP response.
 const server=createServer(async(_req,res)=>{
  try{await fetch(`http://127.0.0.1:${upstream.address().port}`,{signal:AbortSignal.any([proxyAbort.signal,AbortSignal.timeout(20000)])});}
  catch(error){proxyAborted=proxyAbort.signal.aborted;if(!res.destroyed)res.end(String(error));}
  finally{finished();}
 });
 const bridge=spawn('/bin/sleep',['30'],{stdio:'ignore'});
 let request;
 try{
  await bounded('Actual process spawn',once(bridge,'spawn'));
  upstream.listen(0,'127.0.0.1');await bounded('Upstream listen',once(upstream,'listening'));
  server.listen(0,'127.0.0.1');await bounded('Proxy listen',once(server,'listening'));
  request=fetch(`http://127.0.0.1:${server.address().port}`).then(()=>null,error=>String(error));
  await bounded('Actual upstream receipt',Promise.race([receiving,request.then(result=>{throw new Error(`Proxy request ended before the upstream received it: ${result}`);})]));
  const before=performance.now();
  const receipt=await retireNativeBrowserOwners({bridge,server,proxyAbort});
  assert.ok(performance.now()-before<4000,'HTTP drain cannot postpone bridge retirement');
  assert.equal(receipt.bridge.ok,true);assert.equal(receipt.server.ok,true);
  assert.ok(bridge.exitCode!==null||bridge.signalCode!==null,'Actual child exit was observed');
  await bounded('Aborted client request',request);
  await bounded('Aborted upstream exchange',proxyStopped);
  assert.equal(proxyAborted,true,'The real in-flight upstream exchange was aborted');
 }finally{
  const results=await Promise.all([
   retireNativeBrowserOwners({bridge,server,proxyAbort}),
   retireNativeBrowserOwners({server:upstream})
  ]);
  for(const result of results)for(const cleanup of Object.values(result))assert.equal(cleanup.ok,true,cleanup.error);
 }
});
