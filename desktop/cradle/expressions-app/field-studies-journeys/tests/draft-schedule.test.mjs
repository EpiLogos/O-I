import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DraftSchedule,DRAFT_DEBOUNCE_MS,draftStatusLine} from '../build/draftSchedule.js';

// lane-3 E17: one autosave schedule. Time is a fake clock so every bound is exact.
function fakeTimers(){
 let now=0,seq=0;const queue=[];
 return {
  set(run,ms){const id=++seq;queue.push({id,at:now+ms,run});return id;},
  clear(id){const i=queue.findIndex(t=>t.id===id);if(i>=0)queue.splice(i,1);},
  advance(ms){const target=now+ms;for(;;){queue.sort((a,b)=>a.at-b.at||a.id-b.id);const next=queue[0];if(!next||next.at>target)break;queue.shift();now=next.at;next.run();}now=target;},
  get armed(){return queue.length;},
 };
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function harness(extra={}){
 const timers=fakeTimers(),calls=[];let open=false;
 const schedule=new DraftSchedule({timers,gestureOpen:()=>open,flush:reason=>{calls.push(reason);return Promise.resolve();},...extra});
 return {timers,calls,schedule,setGesture:v=>{open=v;}};
}

test('the debounce is the existing 350 ms coalescing window', ()=>{
 assert.equal(DRAFT_DEBOUNCE_MS,350);
 const {timers,calls,schedule}=harness();
 schedule.request();
 timers.advance(349);assert.equal(calls.length,0,'not before the window closes');
 timers.advance(1);assert.deepEqual(calls,['edit']);
});

test('later edits ride the armed timer: a backup never waits past 350 ms after the first unflushed edit', async()=>{
 const {timers,calls,schedule}=harness();
 schedule.request();timers.advance(100);schedule.request();timers.advance(100);schedule.request();timers.advance(100);schedule.request();
 timers.advance(49);assert.equal(calls.length,0);
 timers.advance(1);assert.equal(calls.length,1,'one backup at the window, not reset by each edit');
 await settle();
 schedule.request();timers.advance(350);assert.equal(calls.length,2,'the next edit starts its own window');
});

test('a context switch flushes at once, and only when an edit is waiting', ()=>{
 const {calls,schedule}=harness();
 schedule.flushNow('scene');assert.equal(calls.length,0,'nothing dirty: no write');
 schedule.request();schedule.flushNow('scene');assert.deepEqual(calls,['scene'],'immediate, synchronously, with the reason');
 schedule.flushNow('studio');assert.deepEqual(calls,['scene'],'a second switch with no new edit does not write');
});

test('the flush runs synchronously so it reads the departing document', ()=>{
 let seenAtCall=null;const schedule=new DraftSchedule({timers:fakeTimers(),flush:()=>{seenAtCall='called';return Promise.resolve();}});
 schedule.request();schedule.flushNow('rail');assert.equal(seenAtCall,'called');
});

test('quit always writes, so the session mark can settle even with nothing new', async()=>{
 const {calls,schedule}=harness();
 await schedule.flushNow('quit');assert.deepEqual(calls,['quit']);
});

test('nothing flushes inside an open gesture; the backup waits for the gesture to end', ()=>{
 const {timers,calls,schedule,setGesture}=harness();
 setGesture(true);schedule.request();schedule.flushNow('studio');
 timers.advance(350);assert.equal(calls.length,0,'the gesture holds the backup');
 assert.ok(schedule.pending()>0,'the edit stays pending while the gesture is open');
 setGesture(false);timers.advance(350);assert.deepEqual(calls,['edit']);
});

test('pending writes count unflushed edits and a backup in flight, and reach zero when the backup lands', async()=>{
 let release;const schedule=new DraftSchedule({timers:fakeTimers(),flush:()=>new Promise(resolve=>{release=resolve;})});
 schedule.request();assert.equal(schedule.pending(),1);
 const flight=schedule.flushNow('scene');assert.equal(schedule.pending(),1,'in flight, nothing left unflushed');
 release();await flight;await settle();
 assert.equal(schedule.pending(),0);
});

test('quit during a backup returns that same backup rather than writing twice', async()=>{
 let count=0,release;const schedule=new DraftSchedule({timers:fakeTimers(),flush:()=>{count++;return new Promise(resolve=>{release=resolve;});}});
 schedule.request();const first=schedule.flushNow('scene');const second=schedule.flushNow('quit');
 assert.equal(count,1);release();await first;await second;await settle();
 assert.equal(schedule.pending(),0);
});

test('an edit made during a backup is written again once that backup lands', async()=>{
 const timers=fakeTimers();let count=0,release;
 const schedule=new DraftSchedule({timers,flush:()=>{count++;return new Promise(resolve=>{release=resolve;});}});
 schedule.request();timers.advance(350);assert.equal(count,1);
 schedule.request();release();await settle();await settle();
 assert.equal(timers.armed,1,'the follow-up is armed, not run inside the failed or finished flight');
 timers.advance(350);assert.equal(count,2);
});

test('a failed backup does not loop: the edits stay pending until the next change', async()=>{
 const timers=fakeTimers();let count=0;
 const schedule=new DraftSchedule({timers,flush:()=>{count++;return Promise.reject(new Error('storage full'));}});
 schedule.request();timers.advance(350);await settle();await settle();
 timers.advance(5000);assert.equal(count,1,'no retry storm');
 schedule.request();timers.advance(350);assert.equal(count,2,'the next change tries again');
});

test('cancel forgets the pending backup for a document removed on purpose', ()=>{
 const {timers,calls,schedule}=harness();
 schedule.request();schedule.cancel();timers.advance(1000);
 assert.equal(calls.length,0);assert.equal(schedule.pending(),0);
});

test('status line keeps the existing voice and names the local time', ()=>{
 const at=new Date(2026,9,13,14,5,9);
 assert.equal(draftStatusLine('backed-up',at,'browser'),'Draft backed up in this browser · 14:05');
 assert.equal(draftStatusLine('backed-up',new Date(2026,9,13,9,7),'native'),'Working copy backed up on this device · 09:07');
 assert.equal(draftStatusLine('waiting',at,'browser'),'Newer edits are waiting for backup');
 assert.equal(draftStatusLine('refused',at,'native'),'Working copy not backed up');
 assert.equal(draftStatusLine('unavailable',at,'browser'),'Not saved · export a file');
});

test('app.ts has one draft schedule and no competing timer or reschedule', ()=>{
 const source=fs.readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
 assert.equal((source.match(/new DraftSchedule\(/g)||[]).length,1,'exactly one scheduler');
 assert.ok(!/saveTimeout/.test(source),'the old saveTimeout is gone');
 assert.ok(!/setTimeout\(\(\)=>void flushDraft/.test(source),'no direct timer reschedules flushDraft');
 for(const trigger of ["flushNow('scene')","flushNow('studio')","flushNow('rail')","flushNow('hidden')","flushNow('quit')","addEventListener('beforeunload'"])
  assert.ok(source.includes(trigger),`context-switch trigger wired: ${trigger}`);
});

// T-REVIEW-6: a draft held by an open boot recovery choice is never written; a backup that does not land keeps its
// edits pending; an edit made during a backup is written by a quit rather than left to a timer an unload cuts off.
test('T-REVIEW-6: a held draft is never written: no timer, context switch or quit writes it, and the edit waits', async()=>{
 const timers=fakeTimers(),calls=[];let held=true;
 const schedule=new DraftSchedule({timers,held:()=>held,flush:reason=>{calls.push(reason);return Promise.resolve();}});
 schedule.request();timers.advance(1000);
 schedule.flushNow('scene');await schedule.flushNow('quit');
 assert.deepEqual(calls,[],'nothing is written while the recovery choice is open');
 assert.ok(schedule.pending()>0,'the edit stays pending, so it is not forgotten');
 held=false;schedule.flushNow('scene');
 assert.deepEqual(calls,['scene'],'the held edit is written once the choice is carried out');
});

test('T-REVIEW-6: a quit during a backup writes the edits made during that backup once it lands', async()=>{
 const timers=fakeTimers(),calls=[],releases=[];
 const schedule=new DraftSchedule({timers,flush:reason=>{calls.push(reason);return new Promise(resolve=>{releases.push(resolve);});}});
 schedule.request();timers.advance(350);
 schedule.request();
 const quit=schedule.flushNow('quit');
 assert.deepEqual(calls,['edit'],'the quit does not start a second write while the first is in flight');
 releases[0]();await settle();
 assert.deepEqual(calls,['edit','quit'],'the quit writes the edit made during the flight');
 releases[1]();await quit;await settle();
 assert.equal(schedule.pending(),0);
});

test('T-REVIEW-6: a backup that rejects keeps its edits pending, and the next context switch retries it', async()=>{
 const timers=fakeTimers(),calls=[];let fail=true;
 const schedule=new DraftSchedule({timers,flush:reason=>{calls.push(reason);return fail?Promise.reject(new Error('storage full')):Promise.resolve(true);}});
 schedule.request();timers.advance(350);await settle();await settle();
 assert.equal(schedule.pending(),1,'the edit is still pending after the failure');
 fail=false;schedule.flushNow('rail');
 assert.deepEqual(calls,['edit','rail'],'a context switch retries it at once');
});

test('T-REVIEW-6: a flush that reports it did not hold (false) is a failed backup, not a success', async()=>{
 const timers=fakeTimers(),calls=[];
 const schedule=new DraftSchedule({timers,flush:reason=>{calls.push(reason);return Promise.resolve(false);}});
 schedule.request();schedule.flushNow('scene');await settle();await settle();
 assert.equal(schedule.pending(),1,'a refused backup keeps its edit pending');
 schedule.flushNow('studio');
 assert.deepEqual(calls,['scene','studio'],'the next context switch tries again');
});
