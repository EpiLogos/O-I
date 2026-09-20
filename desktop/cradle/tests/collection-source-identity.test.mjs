import test from 'node:test';
import assert from 'node:assert/strict';
import {readCollection,assembleCollectionReading} from '../src/expressions/collectionReadings.ts';
import {memoryTransport,repositoryFiles,realManifests,transport,location,revisionOf} from './collection-transport.mjs';

const manifestPath='Work/Test/ProjectCentral/user/collections/test.manifest.json';
const base=manifestPath.slice(0,manifestPath.lastIndexOf('/'));
const makeManifest=(n=12)=>({schema:'oi.legacy-collections/v1',featured:Array.from({length:n},(_,i)=>({id:'s'+i,name:'Subject '+i,file:`items/s${i}.json`}))});
function specimen(n=12){const m=makeManifest(n),files=new Map([[manifestPath,JSON.stringify(m)]]);for(const e of m.featured)files.set(`${base}/${e.file}`,JSON.stringify({id:e.id}));return {m,files};}
async function withTransport(t,fn){const old=globalThis.fetch;globalThis.fetch=t.fetch;try{return await fn(t);}finally{globalThis.fetch=old;}}

test('every committed collection member resolves its own exact bytes, location and identity',async()=>{
 const files=await repositoryFiles();
 await withTransport(memoryTransport(files),async()=>{
  for(const m of realManifests){
   const p='Work/O-I/desktop/cradle/expressions-app/'+m;
   const result=await readCollection(transport,p);
   assert.equal(result.status,'ready');
   assert.deepEqual(result.errors,[]);
   for(const member of result.members){
    assert.equal(member.content.id,member.id,`${m}: ${member.id} was replaced by ${member.content.id}`);
    const exact=p.slice(0,p.lastIndexOf('/'))+'/'+member.file;
    assert.deepEqual(member.location,location(exact));
    assert.deepEqual(member.content,JSON.parse(files.get(exact)));
   }
  }
 });
});

test('four concurrent reads, manifest order and one directory reading per parent',async()=>{
 const {files}=specimen();let active=0,max=0;
 await withTransport(memoryTransport(files,{onRead:async p=>{if(!p.endsWith('.manifest.json')){max=Math.max(max,++active);await new Promise(r=>setTimeout(r,p.endsWith('s0.json')?8:1));active--;}}}),async t=>{
  const r=await readCollection(transport,manifestPath);
  assert.equal(max,4);assert.deepEqual(r.members.map(m=>m.id),Array.from({length:12},(_,i)=>'s'+i));
  assert.equal(t.ops.filter(o=>o.op==='files_list'&&o.path===base+'/items').length,1);
  for(const m of r.members)assert.equal(m.source_revision,revisionOf(files.get(base+'/'+m.file)));
  assert.equal(r.basis.revision,revisionOf(files.get(manifestPath)));assert.equal(r.coverage.complete,true);
 });
});

test('bounded pages retain every membership and never call a slice complete',async()=>{
 const {files}=specimen(193);
 await withTransport(memoryTransport(files),async t=>{
  const first=await readCollection(transport,manifestPath);
  assert.equal(first.members.length,64);assert.equal(first.coverage.total,193);assert.equal(first.envelope.featured.length,193);
  assert.equal(first.coverage.next_offset,64);assert.equal(first.coverage.complete,false);
  const all=[...first.members];let offset=first.coverage.next_offset;
  while(offset!==null){const page=await readCollection(transport,manifestPath,{offset,expectedRevision:first.basis.revision});all.push(...page.members);assert.equal(page.coverage.complete,false);offset=page.coverage.next_offset;}
  assert.equal(all.length,193);assert.equal(new Set(all.map(m=>m.location.ref)).size,193);
  assert.deepEqual(all.map(m=>m.slot),Array.from({length:193},(_,i)=>i));
  assert.equal(t.ops.filter(o=>o.op==='file_read'&&!o.location.path.endsWith('.manifest.json')).length,193);
 });
});

test('discovery resolves all subjects without reading any body or stamping an export time as revision',async()=>{
 const {files}=specimen(193);
 await withTransport(memoryTransport(files),async t=>{
  const r=await readCollection(transport,manifestPath,{readContents:false});
  assert.equal(r.members.length,193);assert.equal(r.coverage.content,'deferred');
  assert.equal(t.ops.filter(o=>o.op==='file_read').length,1);
  for(const m of r.members){assert.equal(m.content,undefined);assert.equal(m.source_revision,undefined);assert.equal(m.content_state,'deferred');assert.ok(m.location.ref);}
 });
});

test('missing, refused, malformed and wrong-id leaves are named at their original slots',async()=>{
 const {files}=specimen(8);files.delete(base+'/items/s1.json');files.set(base+'/items/s2.json','not JSON');files.set(base+'/items/s4.json',JSON.stringify({id:'s3'}));
 await withTransport(memoryTransport(files,{deny:[base+'/items/s6.json']}),async t=>{
  const r=await readCollection(transport,manifestPath);
  assert.deepEqual(r.errors.map(e=>e.slot),[1,2,4,6]);assert.deepEqual(r.members.map(e=>e.id),['s0','s3','s5','s7']);
  assert.equal(r.coverage.complete,false);assert.equal(r.coverage.failed,4);assert.equal(r.envelope.featured.length,8);
  assert.match(r.errors[0].message,/not present/);assert.match(r.errors[2].message,/where the manifest names/);assert.match(r.errors[3].message,/withholds retrieval/);
  assert.equal(t.ops.some(o=>o.op==='file_read'&&o.location.path.endsWith('s6.json')),false);
 });
});

test('source identity must match the exact owner location, not just a display name',async()=>{
 const {files}=specimen(1);
 for(const key of ['ref','path','root','schema'])await withTransport(memoryTransport(files,{rewriteRead:r=>r.location.path.endsWith('s0.json')?{...r,location:{...r.location,[key]:'other'}}:r}),async()=>{
  const r=await readCollection(transport,manifestPath);assert.equal(r.members.length,0);assert.match(r.errors[0].message,/identity/);
 });
 await withTransport(memoryTransport(files,{rewriteRead:r=>({...r,location:{...r.location,root:'different'}})}),async()=>{
  assert.equal((await readCollection(transport,manifestPath)).status,'unavailable');
 });
});

test('changed manifest revision refuses continuation before member retrieval',async()=>{
 const {files}=specimen(80);
 await withTransport(memoryTransport(files),async t=>{
  const first=await readCollection(transport,manifestPath);files.set(manifestPath,JSON.stringify(makeManifest(79)));
  const start=t.ops.length;
  const page=await readCollection(transport,manifestPath,{offset:64,expectedRevision:first.basis.revision});
  assert.equal(page.status,'unavailable');assert.match(page.message,/changed/);
  assert.equal(t.ops.slice(start).filter(o=>o.op==='file_read').length,1);
 });
});

test('refresh and subsequent worlds never reuse a prior leaf, revision or refusal',async()=>{
 const {files}=specimen(2);let r1;
 await withTransport(memoryTransport(files,{root:'one'}),async()=>{r1=await readCollection(transport,manifestPath);});
 files.set(base+'/items/s1.json',JSON.stringify({id:'s1',newRevision:true}));
 await withTransport(memoryTransport(files,{root:'two'}),async t=>{
  const r2=await readCollection(transport,manifestPath,{fresh:true});
  assert.notEqual(r2.members[1].location.ref,r1.members[1].location.ref);assert.notEqual(r2.members[1].source_revision,r1.members[1].source_revision);
  assert.equal(r2.members[1].content.newRevision,true);assert.ok(t.ops.filter(o=>o.op==='files_list').every(o=>o.fresh===true));
 });
});

test('absent and denied manifests have different outcomes and no denied read',async()=>{
 const {files}=specimen(1);
 await withTransport(memoryTransport(files,{deny:[manifestPath]}),async t=>{
  assert.equal((await readCollection(transport,manifestPath)).status,'unavailable');assert.equal(t.ops.some(o=>o.op==='file_read'),false);
 });
 files.delete(manifestPath);
 await withTransport(memoryTransport(files),async()=>{assert.equal((await readCollection(transport,manifestPath)).status,'manifest-absent');});
 await withTransport(memoryTransport(files,{failDirs:{[base]:'provider offline'}}),async()=>{const r=await readCollection(transport,manifestPath);assert.equal(r.status,'unavailable');assert.match(r.message,/provider offline/);});
});

test('cancellation stops new batches and preserves the unattempted boundary',async()=>{
 const {files}=specimen(99);const abort=new AbortController();
 await withTransport(memoryTransport(files,{onRead:p=>{if(p.endsWith('s0.json'))abort.abort();}}),async t=>{
  const r=await readCollection(transport,manifestPath,{signal:abort.signal});
  assert.equal(r.coverage.cancelled,true);assert.equal(r.coverage.complete,false);assert.equal(r.coverage.attempted,4);assert.equal(r.coverage.next_offset,4);
  assert.ok(t.ops.filter(o=>o.op==='file_read').length<=5);
  const before=t.ops.length;assert.equal((await readCollection(transport,manifestPath,{signal:abort.signal})).status,'unavailable');assert.equal(t.ops.length,before);
 });
});

test('invalid envelopes are refused before any member read; unknown additive provenance is preserved',async()=>{
 const bad=[null,[],{}, {schema:'other'}, {...makeManifest(1),featured:'bad'}, {...makeManifest(1),featured:[null]}, {...makeManifest(1),featured:[{id:'s0',file:'../private.json'}]}, {...makeManifest(1),featured:[{id:'s0',file:'/private.json'}]}, {...makeManifest(1),featured:[{id:'s0',file:'https://example.test/source'}]}, {...makeManifest(1),featured:[{id:'s0',file:'a\\b'}]}, {...makeManifest(1),starters:[{id:'s0',file:'items/s0.json'}]}, {...makeManifest(1),provenance:{schema:'oi.collection-provenance/v1'}}];
 for(const m of bad){let reads=0;const r=await assembleCollectionReading(manifestPath,JSON.stringify(m),async()=>{reads++;});assert.equal(r.status,'unavailable',JSON.stringify(m));assert.equal(reads,0);}
 const m={...makeManifest(1),provenance:{schema:'future/provenance',opaque:{source:'retained'}},authored:{note:'do not normalise away'}};
 const r=await assembleCollectionReading(manifestPath,JSON.stringify(m),async()=>({id:'s0'}));assert.deepEqual(r.envelope,m);
});

test('negative, fractional and outside offsets and zero limits are not partial successes',async()=>{
 for(const options of [{offset:-1},{offset:0.5},{offset:2},{limit:0},{limit:Infinity}]){
  let reads=0;const r=await assembleCollectionReading(manifestPath,JSON.stringify(makeManifest(1)),async()=>{reads++;return {id:'s0'};},options);
  assert.equal(r.status,'unavailable');assert.equal(reads,0);
 }
});
