import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeSelectionQueue} from '../build/nativeSelectionQueue.js';
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
test('a later gesture is not lost while the first native selection returns',async()=>{
 const barrier=deferred(),entered=deferred(),effects=[];
 const queue=new NativeSelectionQueue({available:()=>true,current:()=>true,apply:async value=>{effects.push(value);if(value==='first'){entered.resolve();await barrier.promise;}return true;}});
 const first=queue.submit('first');await entered.promise;
 const skipped=queue.submit('middle'),latest=queue.submit('latest');
 assert.equal(await skipped,'superseded');assert.deepEqual(effects,['first']);
 barrier.resolve();assert.equal(await first,'applied');assert.equal(await latest,'applied');
 assert.deepEqual(effects,['first','latest']);
});
test('busy composition/file operations defer focus, not abandon it',async()=>{
 let busy=true;const effects=[];
 const queue=new NativeSelectionQueue({available:()=>!busy,current:()=>true,apply:async value=>{effects.push(value);return true;}});
 const earlier=queue.submit('a'),later=queue.submit('b');assert.equal(await earlier,'superseded');
 assert.deepEqual(effects,[]);busy=false;queue.resume();assert.equal(await later,'applied');assert.deepEqual(effects,['b']);
});
test('navigation invalidates undispatched gestures without cancelling the original authorised write',async()=>{
 let generation=0;const barrier=deferred(),entered=deferred(),effects=[];
 const queue=new NativeSelectionQueue({available:()=>true,current:value=>value.generation===generation,apply:async value=>{effects.push(value.ref);if(value.ref==='old-first'){entered.resolve();await barrier.promise;}return true;}});
 const first=queue.submit({generation,ref:'old-first'});await entered.promise;
 const stale=queue.submit({generation,ref:'old-last'});generation++;queue.cancel();assert.equal(await stale,'invalidated');
 const next=queue.submit({generation,ref:'new-work'});barrier.resolve();await first;assert.equal(await next,'applied');
 assert.deepEqual(effects,['old-first','new-work']);
});
test('a queued selection cannot cross a changed native basis even without explicit cancellation',async()=>{
 let ready=false,reference='old';const effects=[];
 const queue=new NativeSelectionQueue({available:()=>ready,current:value=>value===reference,apply:async value=>{effects.push(value);return true;}});
 const stale=queue.submit('old');reference='new';ready=true;queue.resume();assert.equal(await stale,'invalidated');assert.deepEqual(effects,[]);
});
test('refusal is not reported as applied and does not cause an automatic write retry',async()=>{
 const effects=[];
 const queue=new NativeSelectionQueue({available:()=>true,current:()=>true,apply:async value=>{effects.push(value);return false;}});
 assert.equal(await queue.submit('refused'),'failed');queue.resume();assert.deepEqual(effects,['refused']);
});
