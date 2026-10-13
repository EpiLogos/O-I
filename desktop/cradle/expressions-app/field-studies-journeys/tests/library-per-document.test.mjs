import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {blankJourney} from '../build/model.js';
import {readLibraryDetailed,readLibrary,saveToLibrary,removeFromLibrary,setLibraryQuarantine,sweepLibraryDamage,STORAGE_KEY} from '../build/store.js';
import {quarantine,listQuarantine} from '../build/draftStorage.js';

// lane-3 E18: the Library is one record per document. The browser's localStorage is replaced by a synchronous fake installed on
// globalThis, so the real default backend is exercised. The fake can refuse writes, truncate them (a torn write) or go unavailable.
class MemoryStorage{
 constructor(){this.map=new Map();this.broken=false;this.writeFilter=null;}
 get length(){if(this.broken)throw new Error('SecurityError: storage is unavailable');return this.map.size;}
 key(index){return [...this.map.keys()][index]??null;}
 getItem(key){if(this.broken)throw new Error('SecurityError: storage is unavailable');return this.map.has(key)?this.map.get(key):null;}
 setItem(key,value){if(this.broken)throw new Error('SecurityError: storage is unavailable');let text=String(value);if(this.writeFilter){text=this.writeFilter(key,text);}this.map.set(key,text);}
 removeItem(key){this.map.delete(key);}
}
const storage=new MemoryStorage();
Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true,writable:true});

const DOC='oi.field-studies.journey-library.v2.doc.';
const HELD='oi.field-studies.journey-library.v2.held.';
const ORDER='oi.field-studies.journey-library.v2.order';
// Each document is a pair of slots (#a, #b); the order is a pair too.
const slotsOf=id=>[...storage.map.entries()].filter(([key])=>key.startsWith(DOC+id+'#')).sort(([x],[y])=>x.localeCompare(y));
const LEGACY=STORAGE_KEY;

// The quarantine store the drafts use, in memory. recovery.ts registers the same shape in production.
const quarantineMap=new Map();
const quarantineStore={
 async get(key){return quarantineMap.get(key);},
 async put(key,raw){quarantineMap.set(key,raw);},
 async delete(key){quarantineMap.delete(key);},
 async keys(prefix){return [...quarantineMap.keys()].filter(key=>key.startsWith(prefix));},
};
const registeredSink=(key,raw,reason,at)=>quarantine(quarantineStore,'library',key,raw,reason,at).then(()=>undefined);

function reset(){
 storage.map.clear();storage.broken=false;storage.writeFilter=null;quarantineMap.clear();
 setLibraryQuarantine(registeredSink);
}
function doc(id,name='Field study',updatedAt='2026-10-13T10:00:00.000Z'){const j=blankJourney();j.id=id;j.name=name;j.updatedAt=updatedAt;return j;}
const heldRaws=()=>[...storage.map.entries()].filter(([key])=>key.startsWith(HELD)).map(([,text])=>JSON.parse(text).raw);
const garbage='{"schema":"oi.library-record/v1","seq":1,"body":"{truncated';

test('E18: each saved copy is its own key, listed newest first; the single array is not written', ()=>{
 reset();
 saveToLibrary(doc('a'));saveToLibrary(doc('b'));
 assert.deepEqual(readLibrary().map(j=>j.id),['b','a'],'the newest save is listed first');
 assert.equal(slotsOf('a').length,1,'one saved copy per document, in its own slot');
 assert.equal(slotsOf('b').length,1);
 assert.ok([...storage.map.keys()].some(key=>key.startsWith(ORDER+'#')),'an order pair keeps the newest-first list');
 assert.equal(storage.map.has(LEGACY),false,'the single array is not written');
});

test('E18: saving one document leaves the bytes of another document unchanged', ()=>{
 reset();
 saveToLibrary(doc('a'));const before=JSON.stringify(slotsOf('a'));
 saveToLibrary(doc('b'));
 assert.equal(JSON.stringify(slotsOf('a')),before);
});

test('E18: a torn write of one document keeps its previous copy and every other document', ()=>{
 reset();
 saveToLibrary(doc('a','A'));saveToLibrary(doc('b','B v1'));
 const v1=JSON.stringify(slotsOf('b'));
 storage.writeFilter=(key,text)=>key.startsWith(DOC+'b')?text.slice(0,text.length-9):text;
 assert.throws(()=>saveToLibrary(doc('b','B v2')),/could not be verified/);
 storage.writeFilter=null;
 assert.equal(JSON.stringify(slotsOf('b')),v1,'the previous good copy is untouched: the torn write went to the other slot');
 assert.deepEqual(readLibrary().map(j=>j.name),['B v1','A']);
});

test('E18: a torn order record never hides a saved document', ()=>{
 reset();
 saveToLibrary(doc('a','A'));
 storage.writeFilter=(key,text)=>key.startsWith(ORDER)?text.slice(0,text.length-5):text;
 assert.throws(()=>saveToLibrary(doc('b','B')),/order could not be verified/);
 storage.writeFilter=null;
 assert.deepEqual(readLibrary().map(j=>j.id).sort(),['a','b'],'the document whose order write tore is still listed');
});

test('E18: one corrupt document key leaves the others loading; the bad key is reported and kept verbatim until quarantined', async()=>{
 reset();
 saveToLibrary(doc('a','A'));saveToLibrary(doc('b','B'));
 const [slot]=slotsOf('a').map(([key])=>key);storage.map.set(slot,garbage);
 const read=readLibraryDetailed();
 assert.deepEqual(read.journeys.map(j=>j.id),['b'],'the healthy document loads');
 assert.ok(read.errors.some(e=>e.startsWith('Entry a:')),'the corrupt copy is listed by id');
 assert.equal(storage.map.get(slot),garbage,'nothing is moved by a read: the bytes stay where they were');
 await sweepLibraryDamage();
 assert.equal(storage.map.has(slot),false,'the sweep removes the key only after quarantine reads it back');
 const {records}=await listQuarantine(quarantineStore);
 const row=records.find(r=>r.raw===garbage);
 assert.equal(row.raw,garbage,'the corrupt text is kept byte-exact in the shared quarantine store');
 assert.equal(row.source,'library');
});

test('E18: a failing quarantine keeps the corrupt key in place and reports it', async()=>{
 reset();
 saveToLibrary(doc('a','A'));
 const [slot]=slotsOf('a').map(([key])=>key);storage.map.set(slot,garbage);
 setLibraryQuarantine(async()=>{throw new Error('quota');});
 readLibraryDetailed();
 assert.equal(await sweepLibraryDamage(),0);
 assert.equal(storage.map.get(slot),garbage,'nothing was removed without its verbatim copy');
 setLibraryQuarantine(registeredSink);
});

test('E18: saving over a corrupt copy of the same expression holds its bytes before it is replaced', ()=>{
 reset();
 saveToLibrary(doc('a','A'));
 const [slot]=slotsOf('a').map(([key])=>key);storage.map.set(slot,garbage);
 saveToLibrary(doc('a','A2'));
 assert.equal(readLibrary()[0].name,'A2');
 assert.ok(heldRaws().includes(garbage),'the damaged bytes are held verbatim before the replacement');
});

test('E18: a removal deletes only an understood copy; a corrupt copy is never removed by a delete', ()=>{
 reset();
 saveToLibrary(doc('a'));saveToLibrary(doc('b'));
 const [slot]=slotsOf('b').map(([key])=>key);storage.map.set(slot,garbage);
 removeFromLibrary('a');
 assert.equal(slotsOf('a').length,0);
 removeFromLibrary('b');
 assert.equal(storage.map.get(slot),garbage,'the corrupt copy is retained verbatim');
});

test('E18: a removal interrupted after its document left does not bring the document back', ()=>{
 reset();
 saveToLibrary(doc('a'));saveToLibrary(doc('b'));
 storage.writeFilter=(key,text)=>{if(key.startsWith(ORDER))throw new Error('QuotaExceededError');return text;};
 assert.throws(()=>removeFromLibrary('b'),/QuotaExceededError/);
 storage.writeFilter=null;
 assert.deepEqual(readLibrary().map(j=>j.id),['a'],'the removed document does not come back');
});

test('E18 migration: the single array is split per document, the invalid entry is held verbatim, and the array is retained read-only', async()=>{
 reset();
 storage.map.set(LEGACY,JSON.stringify([doc('b','B'),doc('a','A'),{bogus:true}]));
 const read=readLibraryDetailed();
 assert.deepEqual(read.journeys.map(j=>j.id),['b','a'],'the earlier order is kept');
 assert.equal(storage.map.has(LEGACY),true,'the array is retained read-only for one release');
 assert.ok(storage.map.has('oi.field-studies.journey-library.v2.split'),'the split is proven after every record reads back');
 assert.equal(slotsOf('a').length,1);assert.equal(slotsOf('b').length,1);
 assert.ok(read.errors.some(e=>/did not validate/.test(e)),'the invalid entry is reported');
 assert.ok(heldRaws().includes(JSON.stringify({bogus:true})),'and kept verbatim under a held key');
 await sweepLibraryDamage();
 const {records}=await listQuarantine(quarantineStore);
 assert.ok(records.some(r=>/did not validate/.test(r.reason)&&r.source==='library'),'the sweep moves it into the shared quarantine store with its reason');
});

test('E18 migration: a split that does not read back keeps the array, and every entry still loads', ()=>{
 reset();
 storage.map.set(LEGACY,JSON.stringify([doc('b','B'),doc('a','A')]));
 storage.writeFilter=(key,text)=>key.startsWith(DOC+'a')?text.slice(0,text.length-4):text;
 const first=readLibraryDetailed();
 storage.writeFilter=null;
 assert.equal(storage.map.has(LEGACY),true,'the array is kept while its split is unverified');
 assert.equal(storage.map.has('oi.field-studies.journey-library.v2.split'),false,'no split is proven');
 assert.ok(first.errors.some(e=>/could not be split yet/.test(e)));
 assert.deepEqual(first.journeys.map(j=>j.id).sort(),['a','b'],'both entries still load from the array');
 const second=readLibraryDetailed();
 assert.ok(storage.map.has('oi.field-studies.journey-library.v2.split'),'the next read completes the split and proves it');
 assert.deepEqual(second.journeys.map(j=>j.id),['b','a']);
});

test('E18 migration: an interrupted split is resumed without duplicating or losing a document', ()=>{
 reset();
 storage.map.set(LEGACY,JSON.stringify([doc('b','B'),doc('a','A')]));
 storage.writeFilter=(key,text)=>{if(key.startsWith(DOC+'a'))throw new Error('QuotaExceededError');return text;};
 readLibraryDetailed();
 assert.equal(slotsOf('b').length,1,'the first split record is written');
 storage.writeFilter=null;
 assert.deepEqual(readLibraryDetailed().journeys.map(j=>j.id),['b','a']);
 assert.ok(storage.map.has('oi.field-studies.journey-library.v2.split'));
});

test('E18 migration: a copy of an expression that already has a different saved copy is held, and the saved copy wins', ()=>{
 reset();
 saveToLibrary(doc('a','A current'));
 storage.map.set(LEGACY,JSON.stringify([doc('a','A old')]));
 const read=readLibraryDetailed();
 assert.equal(read.journeys[0].name,'A current');
 assert.ok(heldRaws().some(raw=>raw.includes('A old')),'the earlier copy is kept, not overwritten');
});

test('E18: unavailable browser storage is reported by name, and nothing is overwritten', ()=>{
 reset();
 storage.broken=true;
 assert.equal(readLibraryDetailed().blocked,true);
 assert.throws(()=>saveToLibrary(doc('a')),/could not be read\. It has not been overwritten/);
 assert.throws(()=>removeFromLibrary('a'),/nothing was deleted/);
 storage.broken=false;
});

test('E18: the public names and the read shape are unchanged', ()=>{
 reset();
 saveToLibrary(doc('a'));
 const read=readLibraryDetailed();
 assert.deepEqual(Object.keys(read).sort(),['blocked','errors','journeys','raw'].sort());
 assert.equal(read.raw.length,1,'the stored values are still exposed for the retention checks');
 assert.equal(STORAGE_KEY,'oi.field-studies.journey-library.v1','the legacy key keeps its name');
});

test('E18: Library quarantine and draft quarantine are one store and one section', ()=>{
 const recovery=fs.readFileSync(new URL('../src/recovery.ts',import.meta.url),'utf8');
 assert.match(recovery,/setLibraryQuarantine\(\(key,raw,reason,at\)=>quarantineKV\(\)/,'the Library writes to the draft quarantine store');
 const library=fs.readFileSync(new URL('../src/library.ts',import.meta.url),'utf8');
 assert.match(library,/quarantineView/,'the Library page lists that same store');
});

test('E18 migration: several definitions of one expression each stay readable in saved order; a save replaces them, as before', ()=>{
 reset();
 storage.map.set(LEGACY,JSON.stringify([doc('x','X one'),doc('x','X two')]));
 assert.deepEqual(readLibrary().map(j=>j.name),['X one','X two'],'both definitions load, in the order the array held them');
 assert.equal(readLibraryDetailed().errors.length,0,'neither is reported as unreadable');
 saveToLibrary(doc('x','X three'));
 assert.deepEqual(readLibrary().map(j=>j.name),['X three'],'a save replaces every saved copy of the expression');
});
