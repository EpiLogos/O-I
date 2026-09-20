import test from 'node:test';
import assert from 'node:assert/strict';
import {collectionsProvider} from '../src/library/collectionsProvider.ts';
import {nativeExpressionsProvider} from '../src/library/nativeExpressionsProvider.ts';
import {resolveCollectionSelection} from '../src/library/collectionSelection.ts';
import {editManifestMembership,setNativeCollections,saveNativeCollectionMember} from '../src/library/collectionOperations.ts';
import {memoryTransport,transport,revisionOf} from './collection-transport.mjs';

const path='Work/Test/ProjectCentral/user/collections/a.manifest.json',dir=path.slice(0,path.lastIndexOf('/'));
const query={scope:'local',mode:'techne',text:'',fresh:true};
function specimen(n=3){const m={schema:'oi.legacy-collections/v1',exported_at:'2001-01-01',provenance:{schema:'future/v2',authored:'retained'},featured:Array.from({length:n},(_,i)=>({id:'s'+i,name:'Source '+i,file:'items/s'+i+'.json'}))};return {m,files:new Map([[path,JSON.stringify(m)],...m.featured.map(e=>[dir+'/'+e.file,JSON.stringify({id:e.id,text:'source '+e.id})])])};}
async function use(t,fn){const old=globalThis.fetch;globalThis.fetch=t.fetch;try{return await fn(t);}finally{globalThis.fetch=old;}}
const list=()=>collectionsProvider(transport).list(query,new AbortController().signal);
function rpc(handle){const ops=[];return {ops,fetch:async(_url,init)=>({json:async()=>{const op=JSON.parse(init.body);ops.push(op);return {ok:true,outcome:{result:'expression',data:await handle(op.request)}};}})};}

test('native source identity survives two memberships; discovery reads no bodies, late member is searchable',async()=>{
 const {files,m}=specimen(130);files.set(dir+'/b.manifest.json',JSON.stringify({...m,featured:[{...m.featured[1],name:'Alternative title',group:'Other view'}]}));
 await use(memoryTransport(files),async t=>{
  const r=await list();assert.equal(r.items.length,130);assert.equal(r.coverage.state,'complete');
  const item=r.items.find(i=>i.ref.endsWith('/s1.json'));assert.equal(item.collectionMemberships.length,2);assert.equal(item.ref,item.sourceLocation.ref);assert.equal(item.revision,undefined);assert.equal(item.expressionRef,undefined);
  assert.equal(t.ops.filter(o=>o.op==='file_read').length,2);
  const match=await collectionsProvider(transport).list({...query,text:'Source 129'},new AbortController().signal);assert.equal(match.items.length,1);assert.ok(match.items[0].ref.endsWith('/s129.json'));
  const alternate=await collectionsProvider(transport).list({...query,text:'Alternative title'},new AbortController().signal);assert.equal(alternate.items.length,1);assert.equal(alternate.items[0].ref,item.ref);
 });
});

test('Central-root collections work with no child Project and shared scope performs no private reads',async()=>{
 const {files}=specimen(1);const rooted=new Map([...files].map(([p,c])=>[p.replace('Work/Test/ProjectCentral','Control'),c]));
 await use(memoryTransport(rooted),async t=>{
  const r=await list();assert.equal(r.items.length,1);assert.equal(r.items[0].project,undefined);
  const before=t.ops.length;const shared=await collectionsProvider(transport).list({...query,scope:'shared'},new AbortController().signal);
  assert.deepEqual(shared.items,[]);assert.equal(t.ops.length,before);
 });
});

test('a denied or broken collection is disclosed alongside readable material, never empty success',async()=>{
 const {files,m}=specimen();files.set(dir+'/b.manifest.json',JSON.stringify(m));
 await use(memoryTransport(files,{deny:[dir+'/b.manifest.json']}),async()=>{const r=await list();assert.equal(r.items.length,3);assert.equal(r.coverage.state,'partial');assert.match(r.coverage.reason,/withholds retrieval/);});
 await use(memoryTransport(files,{failDirs:{Work:'offline native provider'}}),async()=>{const r=await list();assert.equal(r.coverage.state,'unavailable');assert.match(r.coverage.reason,/offline/);});
});

test('selection revalidates manifest, exact source and revision and reads only the selected member',async()=>{
 const {files}=specimen();await use(memoryTransport(files),async t=>{
  const item=(await list()).items[1],before=t.ops.length;
  const selected=await resolveCollectionSelection(transport,item);assert.equal(selected.ref,item.ref);assert.equal(selected.revision,revisionOf(files.get(dir+'/items/s1.json')));
  assert.deepEqual(t.ops.slice(before).filter(o=>o.op==='file_read').map(o=>o.location.path),[path,dir+'/items/s1.json']);
  files.set(dir+'/items/s1.json',JSON.stringify({id:'s1',changed:true}));
  await assert.rejects(resolveCollectionSelection(transport,selected),/source revision changed/);
  files.set(path,JSON.stringify({schema:'oi.legacy-collections/v1',featured:[]}));
  await assert.rejects(resolveCollectionSelection(transport,item),/manifest changed/);
 });
});

test('retired, swapped and cancelled selected members never open another source',async()=>{
 const {files}=specimen();await use(memoryTransport(files),async t=>{
  const item=(await list()).items[1];files.delete(dir+'/items/s1.json');await assert.rejects(resolveCollectionSelection(transport,item),/not present/);
  files.set(dir+'/items/s1.json',JSON.stringify({id:'s0'}));await assert.rejects(resolveCollectionSelection(transport,item),/manifest names/);
  await assert.rejects(resolveCollectionSelection(transport,{...item,ref:'other'}),/native source identity/);
  const a=new AbortController();a.abort();const before=t.ops.length;await assert.rejects(resolveCollectionSelection(transport,item,a.signal),/cancelled/);assert.equal(t.ops.length,before);
 });
});

test('rename, reorder and remove mutate only collection references, preserving source bodies and unknown provenance',async()=>{
 const {files,m}=specimen();const originalBodies=[...files].filter(([p])=>p!==path);
 await use(memoryTransport(files),async t=>{
  let item=(await list()).items[1];let result=await editManifestMembership(transport,item.collectionMemberships[0],{kind:'rename',title:'A deliberate view'});assert.equal(result.state,'saved');
  let doc=JSON.parse(files.get(path));assert.equal(doc.featured[1].name,'A deliberate view');assert.deepEqual(doc.provenance,m.provenance);assert.equal(doc.exported_at,m.exported_at);
  item=(await list()).items[1];await editManifestMembership(transport,item.collectionMemberships[0],{kind:'move',direction:'earlier'});
  doc=JSON.parse(files.get(path));assert.deepEqual(doc.featured.map(e=>e.id),['s1','s0','s2']);
  item=(await list()).items[0];await editManifestMembership(transport,item.collectionMemberships[0],{kind:'remove'});
  doc=JSON.parse(files.get(path));assert.deepEqual(doc.featured.map(e=>e.id),['s0','s2']);
  for(const [p,c] of originalBodies)assert.equal(files.get(p),c);
  const writes=t.ops.filter(o=>o.op==='file_operation');assert.equal(writes.length,3);assert.ok(writes.every(o=>o.location.path===path&&o.request.expected_revision));
 });
});

test('native manifest CAS race is not retried and uncertain post-write readback is named',async()=>{
 const {files}=specimen();const t=memoryTransport(files);const old=t.handle;
 t.fetch=async(_url,init)=>({json:async()=>{const op=JSON.parse(init.body);if(op.op==='file_operation')files.set(path,files.get(path)+' ');return {ok:true,outcome:await old(op)};}});
 await use(t,async()=>{const item=(await list()).items[0];await assert.rejects(editManifestMembership(transport,item.collectionMemberships[0],{kind:'rename',title:'candidate'}),/conflict/);assert.equal(t.ops.filter(o=>o.op==='file_operation').length,1);assert.equal(JSON.parse(files.get(path)).featured[0].name,'Source 0');});
 let writes=0;const u=memoryTransport(files);const handle=u.handle;
 u.fetch=async(_url,init)=>({json:async()=>{const op=JSON.parse(init.body);if(op.op==='file_read'&&writes)return {ok:false,error:'offline after successful write'};if(op.op==='file_operation')writes++;return {ok:true,outcome:await handle(op)};}});
 await use(u,async()=>{const item=(await list()).items[0];const r=await editManifestMembership(transport,item.collectionMemberships[0],{kind:'remove'});assert.equal(r.state,'saved_unverified');assert.match(r.message,/Saved at.*offline/);assert.equal(JSON.parse(files.get(path)).featured.length,2);});
});

test('native Expression index exposes retained collection labels, not fabricated aliases or edition currentness',async()=>{
 const t=rpc(()=>({schema:'oi.expression-index/v1',expressions:[{expression_ref:'expression:one',revision:4,title:'One',collections:['Question'],profiles:[]}],editions:[{edition_ref:'edition:old',revision:1,expression_revision:1}]}));
 await use(t,async()=>{const r=await nativeExpressionsProvider(transport).list(query,new AbortController().signal);assert.equal(r.items.length,1);assert.equal(r.items[0].ref,'expression:one');assert.equal(r.items[0].revision,'4');assert.deepEqual(r.items[0].nativeCollections,['Question']);assert.equal(t.ops[0].request.operation,'index');const before=t.ops.length;await nativeExpressionsProvider(transport).list({...query,scope:'shared'},new AbortController().signal);assert.equal(t.ops.length,before);});
});

test('malformed native index rows stay explicitly partial',async()=>{
 await use(rpc(()=>({schema:'oi.expression-index/v1',expressions:[{expression_ref:'edition:not-live',revision:1,title:'Wrong'}]})),async()=>{const r=await nativeExpressionsProvider(transport).list(query,new AbortController().signal);assert.equal(r.items.length,0);assert.equal(r.coverage.state,'partial');assert.match(r.coverage.reason,/invalid/);});
});

test('native membership apply uses exact revision CAS and never implicitly saves',async()=>{
 const t=rpc(r=>({state:'ready',document:{expression_ref:r.expression_ref,revision:r.expected_revision+1,collections:r.changes[0].collections}}));
 await use(t,async()=>{await setNativeCollections(transport,'expression:one',7,['My work']);assert.deepEqual(t.ops[0].request.changes,[{change:'collections_set',collections:['My work']}]);assert.equal(t.ops[0].request.expected_revision,7);assert.equal(t.ops.length,1);});
 const conflict=rpc(()=>({state:'revision_conflict'}));await use(conflict,async()=>{await assert.rejects(setNativeCollections(transport,'expression:one',7,['My work']),/revision_conflict/);assert.equal(conflict.ops.length,1);});
});

test('native save binds source CAS and verifies durable revision without treating live edits as saved',async()=>{
 const doc={expression_ref:'expression:one',revision:7};const file={location:{ref:'exact-source'},revision:'before'};let saved=false;
 const t=rpc(r=>{if(r.operation==='save'){assert.equal(r.expected_file_revision,'before');assert.equal(r.location.ref,'exact-source');saved=true;return {state:'saved',file:{...file,revision:'after'}};}return {state:'ready',document:doc,dirty:!saved,file:{...file,revision:saved?'after':'before'}};});
 await use(t,async()=>{const r=await saveNativeCollectionMember(transport,doc.expression_ref,7);assert.equal(r.dirty,false);assert.deepEqual(t.ops.map(o=>o.request.operation),['inspect','save','inspect']);});
 await use(rpc(()=>({state:'ready',document:doc,dirty:true})),async()=>{await assert.rejects(saveNativeCollectionMember(transport,doc.expression_ref,7),/no native file binding/);});
 let step=0;const uncertain=rpc(()=>{if(++step===1)return {state:'ready',document:doc,file};if(step===2)return {state:'saved',file:{...file,revision:'after'}};throw new Error('transport lost');});
 await use(uncertain,async()=>{await assert.rejects(saveNativeCollectionMember(transport,doc.expression_ref,7),/Source saved at after.*transport lost/);});
});
