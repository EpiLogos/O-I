/** Real bounded event disclosure against one explicitly supplied candidate
 * executable. No injected owner/events or special production test endpoint.
 * This proves native replay and the production typed client; React, GPU,
 * installed encounter and historical memory attribution remain separate. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {kernelOp,eventReplay,readEventHistory,subscribeTopic} from '../src/kernel/bridge.ts';

test('real kernel bounds replay by count/bytes and recovers actual owner state across gaps and restart',{
  skip:process.env.OI_NATIVE_EVENT_REPLAY!=='1',timeout:120000,
},async()=>{
  assert.ok(process.env.OI_KERNEL_BIN,'OI_KERNEL_BIN must name the exact candidate walk-bridge');
  const binary=resolve(process.env.OI_KERNEL_BIN),home=await mkdtemp(join(tmpdir(),'oi-event-replay-native-'));
  const receipt={schema:'oi.kernel-event-replay-native-proof/v1',passed:false,
    scope:'Actual native event log, HTTP boundary and production generation-aware client; no renderer/install/memory-history claim',
    executable:{path:binary,sha256:createHash('sha256').update(await readFile(binary)).digest('hex')},checks:[],pages:{}};
  let child,subscription,stderr='';
  const lifetime=new AbortController(),lifetimeTimer=setTimeout(()=>{lifetime.abort();subscription?.unsubscribe();},100000);
  const nativeOp=(transport,op)=>kernelOp(transport,op,AbortSignal.any([lifetime.signal,AbortSignal.timeout(5000)]));
  const nativeReplay=(transport,cursor=1,generation,limit=128)=>eventReplay(transport,cursor,generation,limit,lifetime.signal);
  const nativeHistory=(transport,generation)=>readEventHistory(transport,generation,lifetime.signal);
  const nativeFetch=url=>fetch(url,{signal:AbortSignal.any([lifetime.signal,AbortSignal.timeout(10000)])});
  const boundedText=chunk=>{stderr=(stderr+String(chunk)).slice(-65536);};
  const stop=async()=>{
    if(!child?.pid||child.exitCode!==null||child.signalCode!==null)return;
    const exited=once(child,'exit');child.kill('SIGTERM');
    const timer=setTimeout(()=>child?.kill('SIGKILL'),5000);
    try{await exited;}finally{clearTimeout(timer);}
  };
  const start=async()=>{
    stderr='';child=spawn(binary,['127.0.0.1:0'],{env:{...process.env,OI_HOME:home},stdio:['ignore','pipe','pipe']});
    child.stderr.on('data',boundedText);
    return new Promise((accept,reject)=>{
      let text='';const timer=setTimeout(()=>finish(Error(`Native startup timed out: ${stderr}`)),15000);
      const error=reason=>finish(reason),exit=code=>finish(Error(`Native bridge exited ${code}: ${stderr}`));
      const finish=(reason,url)=>{clearTimeout(timer);child.off('error',error);child.off('exit',exit);reason?reject(reason):accept({kind:'bridge',url});};
      child.once('error',error);child.once('exit',exit);
      child.stdout.on('data',chunk=>{text=(text+String(chunk)).slice(-65536);const match=/listening on (http:\/\/[^\s]+)/.exec(text);if(match)finish(null,match[1]);});
    });
  };
  const pass=(name,evidence)=>receipt.checks.push({name,passed:true,evidence});
  const waitFor=async(predicate)=>{
    const end=Date.now()+10000;
    while(!predicate()){assert.ok(Date.now()<end,'Native replay observation timed out');await new Promise(resolve=>setTimeout(resolve,20));}
  };
  try{
    let transport=await start();
    const initial=await nativeReplay(transport);assert.equal(initial.resync_required,false);assert.equal(initial.latest_seq,0);
    receipt.pages.initial=initial;
    const generation=initial.generation,surface='native-replay-one-surface';
    const open=async(title)=>{
      const call=await nativeOp(transport,{op:'surface_open',surface_id:surface,kind:'blank',title});
      assert.equal(call.outcome?.result,'surface_opened',call.error);assert.equal(call.outcome.receipts.length,1);
      assert.equal(call.outcome.receipts[0].event,'surface_changed');return call.outcome;
    };
    let last;
    for(let index=0;index<1100;index++)last=await open(`Count ${index}`);
    assert.equal(last.receipts[0].seq,1100);
    const expired=await nativeReplay(transport,1,generation);
    assert.equal(expired.resync_required,true);assert.deepEqual(expired.receipts,[]);assert.equal(expired.next_seq,1101);
    assert.equal(expired.oldest_seq,77);receipt.pages.expired_count=expired;
    await assert.rejects(nativeHistory(transport,generation),/expired/);
    let cursor=expired.oldest_seq,total=0,lastSeq=cursor-1,retainedBytes=0;
    do{
      const page=await nativeReplay(transport,cursor,generation,37);
      assert.equal(page.resync_required,false);assert.ok(page.receipts.length<=37);
      receipt.pages.first_retained_count??=page;
      assert.ok(Buffer.byteLength(JSON.stringify(page))<=512*1024);
      for(const entry of page.receipts){assert.equal(entry.seq,++lastSeq);total++;retainedBytes+=Buffer.byteLength(JSON.stringify(entry));}
      cursor=page.next_seq;if(!page.has_more)break;
    }while(true);
    assert.equal(total,1024);assert.equal(lastSeq,1100);assert.ok(retainedBytes<=4*1024*1024);
    const state=await nativeOp(transport,{op:'state'});assert.equal(state.outcome?.snapshot.surfaces[surface].title,'Count 1099');
    pass('Count eviction keeps exactly1024 strictly ordered events and actual current owner state',{oldest_seq:expired.oldest_seq,latest_seq:1100,retained_count:total,retained_bytes:retainedBytes});

    const observed=[],resyncs=[],errors=[];
    subscription=await subscribeTopic(transport,entry=>observed.push(entry),async page=>{
      const read=await nativeOp(transport,{op:'state'});assert.equal(read.outcome?.result,'state',read.error);
      assert.equal(read.outcome.snapshot.surfaces[surface].title,'Count 1099');
      resyncs.push({generation:page.generation,next_seq:page.next_seq,owner_title:read.outcome.snapshot.surfaces[surface].title});
    },error=>errors.push(error));
    assert.ok(subscription);await waitFor(()=>resyncs.length===1);
    const afterResync=await open('After actual owner resync');await waitFor(()=>observed.length===1);
    assert.deepEqual(observed,afterResync.receipts);assert.deepEqual(errors,[]);
    subscription.unsubscribe();subscription=undefined;
    pass('Production subscriber awaits an actual owner read after loss, then consumes the next exact receipt',{resyncs,post_resync_seq:observed[0].seq});

    for(let index=0;index<51;index++)last=await open(`${index}:`+'b'.repeat(96*1024));
    const byteWindow=await nativeReplay(transport,1,generation);assert.equal(byteWindow.resync_required,true);receipt.pages.byte_eviction=byteWindow;
    assert.ok(byteWindow.oldest_seq>1101,'Byte pressure evicts earlier small events as well');
    cursor=byteWindow.oldest_seq;total=0;retainedBytes=0;
    do{
      const page=await nativeReplay(transport,cursor,generation);
      assert.equal(page.resync_required,false);assert.ok(Buffer.byteLength(JSON.stringify(page))<=512*1024);
      total+=page.receipts.length;retainedBytes+=page.receipts.reduce((bytes,entry)=>bytes+Buffer.byteLength(JSON.stringify(entry)),0);
      cursor=page.next_seq;if(!page.has_more)break;
    }while(true);
    assert.ok(total<1024&&retainedBytes<=4*1024*1024);
    pass('Real payload byte pressure evicts before count capacity; every page obeys512KiB',{oldest_seq:byteWindow.oldest_seq,retained_count:total,retained_bytes:retainedBytes});

    const oversized=await open('Oversized '+ 'z'.repeat(300*1024));
    receipt.oversized_operation_receipt=oversized.receipts[0];
    const oversizedSeq=oversized.receipts[0].seq;assert.ok(Buffer.byteLength(JSON.stringify(oversized.receipts[0]))>256*1024);
    const gap=await nativeReplay(transport,oversizedSeq,generation);receipt.pages.oversized_gap=gap;
    assert.equal(gap.resync_required,true);assert.deepEqual(gap.receipts,[]);assert.equal(gap.next_seq,oversizedSeq+1);
    const current=await nativeOp(transport,{op:'state'});assert.equal(current.outcome?.snapshot.surfaces[surface].title,oversized.snapshot.surfaces[surface].title);
    const caughtUp=await nativeReplay(transport,gap.next_seq,generation);assert.equal(caughtUp.resync_required,false);assert.deepEqual(caughtUp.receipts,[]);receipt.pages.caught_up=caughtUp;
    for(const [cursorValue,generationValue] of [[gap.next_seq+10,generation],[gap.next_seq,undefined],[1,'wrong-generation']]){
      const refusal=await nativeReplay(transport,cursorValue,generationValue);assert.equal(refusal.resync_required,true);assert.deepEqual(refusal.receipts,[]);
    }
    pass('Oversized receipt is a declared gap; future, unqualified reused and wrong-generation cursors cannot silently skip',{oversized_seq:oversizedSeq,next_seq:gap.next_seq,actual_owner_title_bytes:Buffer.byteLength(current.outcome.snapshot.surfaces[surface].title)});
    for(const query of ['cursor=0','cursor=-1','cursor=not-a-number','cursor=18446744073709551616','cursor=1&cursor=2','limit=0','limit=184467440737095516160','generation=','generation=a&generation=b','unknown=value']){
      const response=await nativeFetch(`${transport.url}/event-replay?${query}`);
      assert.equal(response.status,400,query);assert.equal((await response.json()).ok,false);
    }
    assert.equal((await nativeFetch(`${transport.url}/events?since=0`)).status,410);
    pass('HTTP refuses malformed/overflow/duplicate inputs and retires the unbounded endpoint',{malformed_requests:10,retired_status:410});

    await stop();transport=await start();
    const restarted=await nativeReplay(transport,gap.next_seq,generation);
    receipt.pages.restarted=restarted;
    assert.equal(restarted.resync_required,true);assert.notEqual(restarted.generation,generation);assert.equal(restarted.latest_seq,0);assert.equal(restarted.next_seq,1);
    const newState=await nativeOp(transport,{op:'state'});assert.equal(newState.outcome?.result,'state');assert.deepEqual(newState.outcome.snapshot.surfaces,{});
    const newEvent=await open('New actual process state');assert.equal(newEvent.receipts[0].seq,1);
    const newHistory=await nativeHistory(transport,restarted.generation);assert.deepEqual(newHistory.receipts,newEvent.receipts);
    await assert.rejects(nativeHistory(transport,generation),/expired/);
    pass('A real process restart changes generation and resumes from the new actual owner state',{previous_generation:generation,new_generation:restarted.generation,new_seq:1});
    assert.equal(createHash('sha256').update(await readFile(binary)).digest('hex'),receipt.executable.sha256);
    assert.ok(Buffer.byteLength(JSON.stringify(receipt))<=2*1024*1024,'Native replay evidence exceeds its2MiB bound');
    receipt.passed=true;
  }catch(error){receipt.error=String(error?.stack??error);throw error;}
  finally{
    clearTimeout(lifetimeTimer);lifetime.abort();
    subscription?.unsubscribe();await stop();await rm(home,{recursive:true,force:true});
    if(process.env.OI_EVENT_REPLAY_RECEIPT){const path=resolve(process.env.OI_EVENT_REPLAY_RECEIPT);await mkdir(dirname(path),{recursive:true});await writeFile(path,JSON.stringify({...receipt,native_stderr_tail:stderr},null,2)+'\n');}
  }
});
