import test from 'node:test';
import assert from 'node:assert/strict';
import {readSlot,encodeSlot,readPair,writePair,quarantine,listQuarantine,writeRecord,loadRecord,loadRecords,removeRecord,digest,PAIR_SCHEMA} from '../build/draftStorage.js';

// lane-3 E18: per-document draft records. Every store here is an in-memory KeyStore;
// the localStorage and IndexedDB adapters in recovery.ts implement the same contract.
function memory(overrides={}){
 const map=new Map();
 return {map,
  async get(k){return map.has(k)?map.get(k):undefined;},
  async put(k,v){map.set(k,v);},
  async delete(k){map.delete(k);},
  async keys(p){return [...map.keys()].filter(k=>k.startsWith(p));},
  ...overrides};
}
const at=new Date(2026,9,13,10,0,0);
const validate=value=>{if(!value||typeof value.n!=='number')throw new Error('n must be a number');return value;};
function layout(extra={}){const store=memory(),q=memory();return {store,quarantine:q,prefix:'',paired:true,source:'draft',...extra};}

test('a versioned pair round-trips and the newest valid write wins', async()=>{
 const l=layout();
 for(const n of [1,2,3])await writeRecord(l,'j1',JSON.stringify({n}),at);
 const {value}=await loadRecord(l,'j1',validate,at);
 assert.deepEqual(value,{n:3});
 assert.deepEqual([...l.store.map.keys()].sort(),['j1#a','j1#b'],'two slots alternate');
});

test('a torn write leaves the previous good copy, and the torn bytes are kept verbatim', async()=>{
 const l=layout();
 await writeRecord(l,'j1',JSON.stringify({n:1}),at);
 const realPut=l.store.put;
 let torn='';
 l.store.put=async(k,raw)=>{torn=raw.slice(0,raw.length-9);await realPut(k,torn);};
 await assert.rejects(writeRecord(l,'j1',JSON.stringify({n:2}),at),/previous copy is retained/);
 l.store.put=realPut;
 const {value,quarantined}=await loadRecord(l,'j1',validate,at);
 assert.deepEqual(value,{n:1},'the previous good copy is what loads');
 assert.equal(quarantined.length,1,'the torn slot is reported');
 const {records}=await listQuarantine(l.quarantine);
 assert.equal(records.length,1);
 assert.equal(records[0].raw,torn,'the torn text is kept byte-exact');
 assert.match(records[0].reason,/torn|damaged/);
});

test('a damaged slot is quarantined before any overwrite, never silently replaced', async()=>{
 const l=layout();
 await writeRecord(l,'j1',JSON.stringify({n:1}),at);
 const garbage='{"schema":"oi.draft-record/v1","seq":9,"body":"oops';
 l.store.map.set('j1#b',garbage);
 await writeRecord(l,'j1',JSON.stringify({n:2}),at);
 const {records}=await listQuarantine(l.quarantine);
 assert.equal(records.find(r=>r.key==='j1#b').raw,garbage,'the damaged slot survives in quarantine');
 assert.deepEqual((await loadRecord(l,'j1',validate,at)).value,{n:2});
});

test('a failing quarantine keeps the damaged slot in place and writes nothing', async()=>{
 const l=layout();
 await writeRecord(l,'j1',JSON.stringify({n:1}),at);
 const garbage='not a record';l.store.map.set('j1#b',garbage);
 l.quarantine.put=async()=>{throw new Error('quota');};
 await assert.rejects(writeRecord(l,'j1',JSON.stringify({n:2}),at),/quota/);
 assert.equal(l.store.map.get('j1#b'),garbage,'nothing was removed without its verbatim copy');
 assert.equal(JSON.parse(l.store.map.get('j1#a')).seq,1,'the good copy is untouched');
});

// T-REVIEW-6 (3b): this record once was quarantined whole on a validation failure. Only damaged bytes are quarantined now; a
// record that parses but does not validate stays in place, is reported, and is never adopted.
test('a record that is a valid envelope but fails validation stays in place and is reported, and the other records still load', async()=>{
 const l=layout();
 await writeRecord(l,'good-1',JSON.stringify({n:1}),at);
 await writeRecord(l,'good-2',JSON.stringify({n:2}),at);
 await writeRecord(l,'bad',JSON.stringify({n:'nope'}),at);
 const {values,quarantined,rejected}=await loadRecords(l,validate,at);
 assert.deepEqual(values.map(v=>v.n).sort(),[1,2],'the healthy records load');
 assert.deepEqual(quarantined,[],'no damage, so nothing is quarantined');
 assert.deepEqual(rejected.map(r=>r.key),['bad'],'the invalid record is reported by key');
 assert.match(rejected[0].reason,/n must be a number/,'the reason names the validation failure');
 assert.equal((await listQuarantine(l.quarantine)).records.length,0,'and it is not moved out of reach');
 assert.equal(JSON.parse(JSON.parse(l.store.map.get('bad#a')??l.store.map.get('bad#b')).body).n,'nope','its stored bytes are untouched');
 assert.equal((await loadRecord(l,'bad',validate,at)).value,undefined,'and never adopted');
});

test('a pre-pair legacy value at the bare key still loads and is superseded by the next write', async()=>{
 const l=layout();
 l.store.map.set('legacy',JSON.stringify({n:7}));
 assert.deepEqual((await loadRecord(l,'legacy',validate,at)).value,{n:7});
 await writeRecord(l,'legacy',JSON.stringify({n:8}),at);
 assert.deepEqual((await loadRecord(l,'legacy',validate,at)).value,{n:8});
});

test('an IndexedDB layout writes the record as one atomic key, without slots', async()=>{
 const l=layout({paired:false});
 await writeRecord(l,'j1',JSON.stringify({n:4}),at);
 assert.deepEqual([...l.store.map.keys()],['j1']);
 assert.deepEqual((await loadRecord(l,'j1',validate,at)).value,{n:4});
});

test('removing a record quarantines its damaged slots first and then clears every slot', async()=>{
 const l=layout();
 await writeRecord(l,'j1',JSON.stringify({n:1}),at);
 l.store.map.set('j1#b','broken-slot');
 await removeRecord(l,'j1',at);
 assert.deepEqual([...l.store.map.keys()],[],'no slot remains');
 const {records}=await listQuarantine(l.quarantine);
 assert.equal(records[0].raw,'broken-slot','the broken slot was kept, not dropped');
});

test('quarantine is idempotent for identical material and lists unreadable entries rather than hiding them', async()=>{
 const q=memory();
 await quarantine(q,'draft','k','same text','r',at);await quarantine(q,'draft','k','same text','r',at);
 assert.equal((await listQuarantine(q)).records.length,1);
 await q.put('stray','{not json');
 const listed=await listQuarantine(q);
 assert.deepEqual(listed.unreadable,['stray']);
});

test('readSlot tells valid from damaged: truncation and a changed body both fail the digest', ()=>{
 const good=encodeSlot(4,'{"n":1}');
 assert.equal(readSlot(good).state,'valid');
 assert.equal(readSlot(good.slice(0,-3)).state,'damaged');
 const tampered=JSON.parse(good);tampered.body='{"n":2}';
 assert.equal(readSlot(JSON.stringify(tampered)).state,'damaged','a body that no longer matches its digest is damaged');
 assert.equal(readSlot(undefined).state,'absent');
 assert.notEqual(digest('abc'),digest('abd'));
 assert.equal(PAIR_SCHEMA,'oi.draft-record/v1');
});

test('writePair picks the older slot, so the newest good copy is never the one overwritten', async()=>{
 const store=memory();
 await writePair(store,'r',"A",async()=>{});
 await writePair(store,'r',"B",async()=>{});
 const before=await readPair(store,'r');
 assert.equal(before.body,'B');
 await writePair(store,'r',"C",async()=>{});
 const after=await readPair(store,'r');
 assert.equal(after.body,'C');
 assert.equal(JSON.parse(store.map.get('r#b')).seq,2,'the seq-2 copy is the one replaced by seq 3 only after seq 3 is written');
});

// T-REVIEW-6 (3b, 3c, 6): only damage is quarantined; a pre-pair bare value is kept verbatim before it is retired or removed.
test('T-REVIEW-6: a record that parses but fails validation stays in place, is reported and never adopted; only damage is quarantined', async()=>{
 const l=layout();
 await writeRecord(l,'bad',JSON.stringify({n:'nope'}),at);
 const snapshot=[...l.store.map];
 const loaded=await loadRecord(l,'bad',validate,at);
 assert.equal(loaded.value,undefined,'never adopted');
 assert.match(loaded.rejected,/n must be a number/,'reported with its reason');
 assert.deepEqual(loaded.quarantined,[],'valid bytes are not quarantined');
 assert.equal((await listQuarantine(l.quarantine)).records.length,0);
 assert.deepEqual([...l.store.map],snapshot,'the stored bytes are untouched');
});

test('T-REVIEW-6: unparseable bytes inside a valid envelope are damage, quarantined verbatim and removed from the live store', async()=>{
 const l=layout();
 l.store.map.set('torn#a',encodeSlot(1,'{not json'));
 const loaded=await loadRecord(l,'torn',validate,at);
 assert.equal(loaded.value,undefined);
 assert.ok(loaded.quarantined.length>=1,'the damage is reported');
 const {records}=await listQuarantine(l.quarantine);
 assert.equal(JSON.parse(records[0].raw).body,'{not json','the bytes are kept verbatim');
 assert.equal(l.store.map.has('torn#a'),false,'the damaged slot leaves the live store');
});

test('T-REVIEW-6: a write over an invalid record keeps the invalid copy verbatim first, paired and atomic alike', async()=>{
 for(const paired of [true,false]){
  const l=layout({paired});
  await writeRecord(l,'j1',JSON.stringify({n:'nope'}),at,validate);
  await writeRecord(l,'j1',JSON.stringify({n:5}),at,validate);
  const {records}=await listQuarantine(l.quarantine);
  assert.equal(records.length,1,`paired=${paired}: the invalid copy is kept, not silently replaced`);
  assert.match(records[0].raw,/nope/);
  assert.deepEqual((await loadRecord(l,'j1',validate,at)).value,{n:5});
 }
});

test('T-REVIEW-6: the next pair write retires a pre-pair bare value only after read-back, keeping its verbatim copy', async()=>{
 const l=layout();
 l.store.map.set('legacy',JSON.stringify({n:7}));
 await writeRecord(l,'legacy',JSON.stringify({n:8}),at,validate);
 assert.equal(l.store.map.has('legacy'),false,'the bare value is gone once the pair holds a valid copy');
 const {records}=await listQuarantine(l.quarantine);
 assert.equal(records.length,1);
 assert.equal(records[0].raw,JSON.stringify({n:7}),'its verbatim copy is kept');
 assert.deepEqual((await loadRecord(l,'legacy',validate,at)).value,{n:8});
 const torn=layout();torn.store.map.set('legacy',JSON.stringify({n:7}));
 const realPut=torn.store.put;
 torn.store.put=async(k,raw)=>{await realPut(k,raw.slice(0,-5));};
 await assert.rejects(writeRecord(torn,'legacy',JSON.stringify({n:8}),at),/previous copy is retained/);
 assert.equal(torn.store.map.get('legacy'),JSON.stringify({n:7}),'a failed read-back leaves the bare value in place');
});

test('T-REVIEW-6: removing a record keeps a bare pre-pair value beside a valid pair verbatim before it is cleared', async()=>{
 const l=layout();
 await writeRecord(l,'j1',JSON.stringify({n:1}),at);
 l.store.map.set('j1',JSON.stringify({n:0}));
 await removeRecord(l,'j1',at);
 assert.deepEqual([...l.store.map.keys()],[],'nothing remains');
 const {records}=await listQuarantine(l.quarantine);
 assert.ok(records.some(r=>r.raw===JSON.stringify({n:0})),'the bare value is kept verbatim');
});

// T-REVIEW-6 (3b, follow-on): removing a record never drops an invalid draft silently; it is kept verbatim first.
test('T-REVIEW-6: removing a record quarantines an invalid draft first, paired and atomic alike', async()=>{
 for(const paired of [true,false]){
  const l=layout({paired});
  await writeRecord(l,'j1',JSON.stringify({n:'nope'}),at);
  await removeRecord(l,'j1',at,validate);
  assert.deepEqual([...l.store.map.keys()],[],`paired=${paired}: the record is removed`);
  const {records}=await listQuarantine(l.quarantine);
  assert.equal(records.length,1,`paired=${paired}: the invalid draft is kept, not dropped`);
  assert.match(records[0].raw,/nope/);
 }
});
