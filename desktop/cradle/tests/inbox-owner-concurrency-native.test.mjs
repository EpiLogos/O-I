/** A real paused native Inbox read must not block the independent Expression
 * owner. Pauses only this test's actual owner process; no substituted replies. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {kernelOp} from '../src/kernel/bridge.ts';
test('native Inbox owner latency cannot hold the Expression mutation queue',{skip:process.env.OI_NATIVE_INBOX_CONCURRENCY!=='1',timeout:60000},async()=>{
 for(const key of ['OI_KERNEL_BIN','OI_BIN','OI_CENTRAL_CTRL_BIN'])assert.ok(process.env[key],key+' required');
 const scratch=await mkdtemp(join(tmpdir(),'oi-inbox-concurrency-')),root=join(scratch,'Central');let child,paused,reading,lockHolder;
 const env={...process.env,CENTRAL_ROOT:root,OI_CENTRAL_ROOT:root,OI_HOME:join(scratch,'oi'),OI_CENTRAL_PROJECT_QUERY:''};
 try{
  await mkdir(root);
  assert.equal(JSON.parse(execFileSync(env.OI_CENTRAL_CTRL_BIN,['--root',root,'--json','action','run','central.init','{}'],{env,encoding:'utf8'})).ok,true);
  child=spawn(env.OI_KERNEL_BIN,['127.0.0.1:0'],{env,detached:true,stdio:['ignore','pipe','pipe']});let stderr='';child.stderr.on('data',b=>stderr+=b);
  const url=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error(stderr||'Bridge startup timed out')),15000);child.once('error',reject);child.stdout.on('data',b=>{out+=b;const m=/listening on (http:\/\/[^ ]+)/.exec(out);if(m){clearTimeout(timer);resolve(m[1]);}});});
  const transport={kind:'bridge',url};
  // Native receiving.rs acquires this existing flock before reading. Hold
  // only this disposable World's lock so its real owner remains observable;
  // no protocol reply, executable or receiving data is replaced.
  await mkdir(join(root,'.central'),{recursive:true});
  lockHolder=spawn('python3',['-u','-c','import fcntl,sys\nf=open(sys.argv[1],"a+")\nfcntl.flock(f,fcntl.LOCK_EX)\nprint("locked",flush=True)\nsys.stdin.buffer.read(1)\nf.close()',join(root,'.central','source-return.lock')],{stdio:['pipe','pipe','pipe']});
  await new Promise((resolve,reject)=>{lockHolder.once('error',reject);lockHolder.once('exit',code=>reject(Error('Native lock holder exited '+code)));lockHolder.stdout.once('data',chunk=>String(chunk).includes('locked')?resolve():reject(Error('Lock acknowledgement missing')));});
  let settled=false;const observed=new Set();
  const deadline=Date.now()+10000;
  while(!paused&&Date.now()<deadline){
   settled=false;
   reading=kernelOp(transport,{op:'receiving',project:null,request:{List:{limit:20,after:null}}}).finally(()=>{settled=true;});
   // Give the real HTTP request a chance to dispatch before observing its
   // subprocess. A small empty native Inbox can legitimately finish first;
   // repeat this read-only observation until an in-flight owner is captured.
   while(!settled&&!paused&&Date.now()<deadline){
    await new Promise(r=>setTimeout(r,0));
    // macOS otherwise truncates the long native executable's argv before
    // the Action name. The suite may also put the actual owner one level
    // below its launcher; its private process group still proves ownership.
    const rows=execFileSync('/bin/ps',['-axww','-o','pid=,ppid=,pgid=,command='],{encoding:'utf8'}).split('\n').flatMap(line=>{const m=/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/.exec(line);return m?[{pid:Number(m[1]),ppid:Number(m[2]),pgid:Number(m[3]),command:m[4]}]:[];});
    const owned=new Set([child.pid]);let grew=true;while(grew){grew=false;for(const row of rows)if(owned.has(row.ppid)&&!owned.has(row.pid)){owned.add(row.pid);grew=true;}}
    for(const row of rows){if(row.pid===child.pid||!owned.has(row.pid))continue;observed.add(row.command.split(' {')[0]);if(row.command.includes('ctrl-macos')&&row.command.includes('central.receiving.list')){try{process.kill(row.pid,'SIGSTOP');paused=row.pid;break;}catch{}}}
   }
   if(!paused){const returned=await reading;assert.equal(returned.error,undefined);}
  }
  assert.ok(paused,'actual child owner must be observed and paused; observed owned descendants: '+[...observed].join(' | '));assert.equal(settled,false);
  const stoppedState=execFileSync('/bin/ps',['-o','stat=','-p',String(paused)],{encoding:'utf8'});assert.match(stoppedState,/T/,'the actual owned native process is stopped');
  const released=once(lockHolder,'exit');lockHolder.stdin.end('release');await released;lockHolder=undefined;
  const ref='expression:inbox-independent-native';
  const result=await Promise.race([kernelOp(transport,{op:'expression',request:{operation:'create',expression_ref:ref,title:'Independent native edit',actor:'human:native-regression'}}),new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('A read-only Inbox request blocked native Expression work')),1500);t.unref();})]);
  assert.equal(result.error,undefined);assert.equal(result.outcome.data.document.expression_ref,ref);assert.equal(settled,false,'Expression finished while actual owner was still paused');
  process.kill(paused,'SIGCONT');paused=undefined;
  const inbox=await reading;assert.equal(inbox.error,undefined);assert.equal(inbox.outcome.result,'receiving_reading');assert.ok(Array.isArray(inbox.outcome.data.returns));
  const rejected=await kernelOp(transport,{op:'receiving',project:'undisclosed-native-project',request:{List:{limit:20,after:null}}});assert.match(rejected.error,/outside Central/);
 }finally{
  if(lockHolder?.exitCode===null){lockHolder.stdin.end();const released=once(lockHolder,'exit');lockHolder.kill('SIGTERM');await released;}
  if(paused)try{process.kill(paused,'SIGCONT');}catch{}
  if(child?.exitCode===null){const stopped=once(child,'exit');try{process.kill(-child.pid,'SIGTERM');}catch{}await stopped;}
  if(reading)await reading.catch(()=>{});await rm(scratch,{recursive:true,force:true});
 }
});
