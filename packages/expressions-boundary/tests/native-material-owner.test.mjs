/** Opt-in real owner regression. Use the already-running candidate:
 * OI_NATIVE_MATERIAL_OWNER=1 OI_NATIVE_MATERIAL_URL=http://127.0.0.1:4180
 * OI_NATIVE_MATERIAL_EVIDENCE_DIRECTORY=Work/.../evidence/native/material-verification-<unique-id>
 * node --experimental-strip-types --test packages/expressions-boundary/tests/native-material-owner.test.mjs
 * No server/build is launched. Gates delay delivery AFTER genuine owner
 * acknowledgement. Only uniquely named test Expressions/checkpoints/Acts change;
 * their native snapshots are saved into the owner-disclosed programme evidence directory. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
const root=new URL('../../../',import.meta.url);
const typescript=new URL('desktop/cradle/node_modules/typescript/lib/typescript.js',root).href;
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(typescript)};import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){try{return await next(specifier,context)}catch(error){
 if(specifier.startsWith('.')&&specifier.endsWith('.js'))return next(specifier.slice(0,-3)+'.ts',context);
 if(specifier.startsWith('.')&&!/\\.[cm]?[jt]s$/.test(specifier))return next(specifier+'.ts',context);throw error;}}
export async function load(url,context,next){if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);
 const source=await readFile(new URL(url),'utf8');return {format:'module',shortCircuit:true,source:ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};}
`)}`,import.meta.url);
const author=new URL('desktop/cradle/expressions-app/field-studies-journeys/src/',root);
const [{createNativeMaterialController,NativeMaterialRefusal},{NativeWorking},{captureNativeAdoption},{DocumentStore},{prepareCompositionEdit},{kernelOp}]=await Promise.all([
 import('../src/nativeMaterials.ts'),import(new URL('nativeWorking.ts',author)),import(new URL('nativeWorkspace.ts',author)),
 import(new URL('store.ts',author)),import(new URL('kernelComposition.ts',author)),import(new URL('desktop/cradle/src/kernel/bridge.ts',root)),
]);
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const enabled=process.env.OI_NATIVE_MATERIAL_OWNER==='1';
const url=process.env.OI_NATIVE_MATERIAL_URL;
const actor='agent:native-material-independent-verification';

test('real material acknowledgements and native checkpoint races preserve exact target and human drafts',{
 skip:enabled?false:'Set OI_NATIVE_MATERIAL_OWNER=1 and an existing OI_NATIVE_MATERIAL_URL',timeout:300000,
},async t=>{
 assert.ok(url,'OI_NATIVE_MATERIAL_URL must name an already-running candidate');
 const refs=[],acts=new Set(),checkpointIds=new Set(),effects=[],gates=new Set(),deliveries=new Set();let gate;
 const evidenceDirectory=process.env.OI_NATIVE_MATERIAL_EVIDENCE_DIRECTORY;
 assert.ok(evidenceDirectory,'OI_NATIVE_MATERIAL_EVIDENCE_DIRECTORY must name an existing bounded owner-relative evidence folder');
 const directoryReply=await kernelOp({kind:'bridge',url},{op:'files_list',path:evidenceDirectory,fresh:true});
 assert.equal(directoryReply.error,undefined,directoryReply.error);
 assert.equal(directoryReply.outcome?.result,'directory_read');
 const evidenceParent=directoryReply.outcome.directory.location;
 assert.ok(evidenceParent.ref);assert.ok(evidenceParent.root);assert.ok(evidenceParent.path);
 const waitGate=async(pause,promise)=>{deliveries.add(promise);await Promise.race([pause.entered.promise,promise.then(()=>{throw Error('The owner operation returned without entering its expected delivery gate');})]);};
 const operation=async(op,request)=>{
  const reply=await kernelOp({kind:'bridge',url},{op,request});assert.equal(reply.error,undefined,reply.error);assert.equal(reply.outcome?.result,op);
  const raw=reply.outcome.data;
  if(op==='expression_world'&&raw.act?.act_ref&&raw.act.expression_ref&&refs.includes(raw.act.expression_ref))acts.add(raw.act.act_ref);
  return raw;
 };
 const expression=async request=>{
  const raw=await operation('expression',request);
  if(gate?.kind==='expression'&&(request.expression_ref??request.document?.expression_ref)===gate.reference){const hold=gate;hold.entered.resolve();await hold.release.promise;}
  return raw;
 };
 const checkpoint=async(id,value)=>{
  checkpointIds.add(id);
  const read=await operation('expression_recovery',{operation:'read',scope:'expressions',kind:'checkpoint',id});
  const written=await operation('expression_recovery',{operation:'write',scope:'expressions',kind:'checkpoint',id,expected_revision:read.record?.revision??null,value});
  assert.equal(written.state,'written');
  if(gate?.kind==='checkpoint'&&value.view?.document.expression_ref===gate.reference){const hold=gate;hold.entered.resolve();await hold.release.promise;}
 };
 const working=()=>new NativeWorking({expression,checkpoint,file:async()=>{assert.fail('These tests must not publish a native file');},mint:()=>{assert.fail('Existing native work must not mint an Expression');}});
 const create=async label=>{
  const ref=`expression:material-verification-${crypto.randomUUID()}`;
  const ready=await expression({operation:'create',expression_ref:ref,title:`Material verification ${label}`,actor});assert.equal(ready.state,'ready');refs.push(ref);
  const work=working(),view=await work.adopt(ready.document);effects.push({operation:'create',expression_ref:ref,revision:view.document.revision});
  return {work,view,record:work.state,document:ready.document};
 };
 const hold=(kind,reference)=>{gate={kind,reference,entered:deferred(),release:deferred()};gates.add(gate);return gate;};
 const editor=row=>{
  let store=new DocumentStore(row.view.journey),selected=store.document.scenes[0].id,generation=1;
  const transitions=[],advances=[];
  const snapshot=()=>({journey:store.document,sceneId:selected,entityId:null});
  const nativeView=()=>row.work.state.view;
  const reading=()=>{const view=nativeView();return {basis:{expression_ref:view.document.expression_ref,revision:view.document.revision,scene_ref:view.bindings[selected].scene_ref,authored_revision:store.revision},
   scene:store.document.scenes.find(s=>s.id===selected),entityOccurrences:{},selection:{entity_ids:[],step_id:null},history:{canUndo:!!store.undoStack.length,canRedo:!!store.redoStack.length},
   standing:{dirty:prepareCompositionEdit(view,store.document).changes.length>0,pending:!!row.work.state.pending,notice:null}};};
  const host={reading,journey:()=>store.document,nativeView,flush:async()=>{await row.work.commit(snapshot());},expressionRequest:expression,
   worldRequest:async request=>{const raw=await operation('expression_world',request);
    if(((gate?.kind==='act'&&request.operation==='act_select')||(gate?.kind==='act-open'&&request.operation==='act_open'))&&raw.act?.expression_ref===gate.reference){const pause=gate;pause.entered.resolve();await pause.release.promise;}return raw;},
   advance:async basis=>{
    assert.deepEqual(reading().basis,basis,'follow starts only on its exact captured editor basis');
    const accept=captureNativeAdoption({snapshot,version:()=>store.revision},()=>generation);
    const view=await row.work.advanceClean(store.document,accept);if(!view||!accept())return false;
    store.replace(view.journey);selected=Object.keys(view.bindings).find(id=>view.bindings[id].scene_ref===view.document.selection.scene_ref)??view.journey.scenes[0].id;
    advances.push(view.document.revision);return true;
   },transition:(duration,easing)=>{transitions.push({duration,easing,basis:reading().basis});},
  };
  return {host,controller:createNativeMaterialController(host),transitions,advances,get store(){return store;},snapshot,
   guard:()=>captureNativeAdoption({snapshot,version:()=>store.revision},()=>generation),
   select(other){generation++;row.work.detach();row.work.restore(other.record,other.view.journey);store=new DocumentStore(other.view.journey);selected=store.document.scenes[0].id;}};
 };
 try{
  const listing=await operation('expression_world',{operation:'material_list',kind:'scene'});assert.equal(listing.state,'materials');
  const chosen=listing.materials.find(item=>item.title==='Review')??listing.materials[0];assert.ok(chosen,'The genuine register must disclose a reusable Scene');
  const material={file_ref:chosen.file_ref,revision:chosen.revision,...(chosen.entry_scene_ref?{scene_ref:chosen.entry_scene_ref}:{})};

  await t.test('clean controller follows an acknowledged native Scene and a native31-second transition',async()=>{
   const row=await create('clean'),local=editor(row),basis=local.host.reading().basis;
   const receipt=await local.controller.perform({basis,material,transition:{duration:31,easing:'linear'}});
   assert.equal(receipt.outcome.state,'act_performed');assert.equal(receipt.followed,true);
   assert.equal(receipt.outcome.act.expression_ref,basis.expression_ref);assert.ok(receipt.outcome.act.basis_revision>basis.revision);
   assert.deepEqual(local.advances,[receipt.outcome.act.basis_revision]);assert.equal(local.transitions.length,1);
   assert.equal(local.transitions[0].duration,31);assert.equal(local.transitions[0].basis.revision,receipt.outcome.act.basis_revision);
   assert.equal(local.transitions[0].basis.scene_ref,receipt.outcome.passage.target_scene_ref);
   const owner=await expression({operation:'inspect',expression_ref:basis.expression_ref});assert.deepEqual(row.work.state.view.document,owner.document);
   effects.push({operation:'act_select',expression_ref:basis.expression_ref,act_ref:receipt.outcome.act.act_ref,revision:owner.document.revision,followed:true});
  });

  await t.test('acknowledged performance arriving after a human edit keeps that exact draft and does not transition',async()=>{
   const row=await create('late edit'),local=editor(row),basis=local.host.reading().basis,pause=hold('act',basis.expression_ref);
   const performing=local.controller.perform({basis,material});await waitGate(pause,performing);
   const owner=await expression({operation:'inspect',expression_ref:basis.expression_ref});assert.ok(owner.document.revision>basis.revision,'the real owner already acknowledged its edit');
   local.store.change(doc=>{doc.name='Human edit after real material acknowledgement';});const draft=structuredClone(local.store.document);
   pause.release.resolve();const receipt=await performing;gate=undefined;
   assert.equal(receipt.followed,false);assert.deepEqual(local.store.document,draft);assert.equal(local.store.undoStack.length,1);
   assert.deepEqual(local.advances,[]);assert.deepEqual(local.transitions,[]);assert.equal(row.work.state.view.document.revision,basis.revision);
   assert.deepEqual((await expression({operation:'inspect',expression_ref:basis.expression_ref})).document,owner.document);
   effects.push({operation:'act_select',expression_ref:basis.expression_ref,act_ref:receipt.outcome.act.act_ref,revision:owner.document.revision,followed:false,retained:'human-draft'});
  });

  await t.test('a human edit arriving after real act-open acknowledgement refuses before material mutation',async()=>{
   const row=await create('before material write'),local=editor(row),basis=local.host.reading().basis,pause=hold('act-open',basis.expression_ref);
   const performing=local.controller.perform({basis,material}),refused=assert.rejects(performing,error=>error instanceof NativeMaterialRefusal&&/material destination changed/.test(error.message));
   await waitGate(pause,performing);
   const owner=await expression({operation:'inspect',expression_ref:basis.expression_ref});assert.deepEqual(owner.document,row.document,'opening a native act did not perform material');
   local.store.change(doc=>{doc.name='Human edit while actual act-open acknowledgement returns';});const draft=structuredClone(local.store.document);
   pause.release.resolve();await refused;gate=undefined;
   assert.deepEqual(local.store.document,draft);assert.equal(local.store.undoStack.length,1);
   assert.deepEqual(local.advances,[]);assert.deepEqual(local.transitions,[]);
   assert.deepEqual((await expression({operation:'inspect',expression_ref:basis.expression_ref})).document,owner.document,'the changed local basis prevented a material mutation');
   effects.push({operation:'act-open-race',expression_ref:basis.expression_ref,revision:owner.document.revision,retained:'human-draft',material_mutation:false});
  });

  await t.test('a late genuine act acknowledgement cannot take over another selected native Expression',async()=>{
   const row=await create('late navigation'),other=await create('selected navigation'),local=editor(row),basis=local.host.reading().basis,pause=hold('act',basis.expression_ref);
   const performing=local.controller.perform({basis,material});await waitGate(pause,performing);
   local.select(other);const selected=structuredClone(local.store.document),nativeSelected=row.work.state;
   pause.release.resolve();const receipt=await performing;gate=undefined;
   assert.equal(receipt.followed,false);assert.deepEqual(row.work.state,nativeSelected);assert.deepEqual(local.store.document,selected);
   assert.deepEqual(local.transitions,[]);assert.deepEqual(local.advances,[]);
   assert.equal(receipt.outcome.act.expression_ref,basis.expression_ref);assert.equal(local.host.reading().basis.expression_ref,other.document.expression_ref);
  });

  await t.test('an edit arriving after the native advance checkpoint write keeps the prior working basis',async()=>{
   const row=await create('checkpoint race'),local=editor(row),basis=local.host.reading().basis;
   const advanced=await expression({operation:'edit',expression_ref:basis.expression_ref,expected_revision:basis.revision,actor,changes:[{change:'rename',title:'Actual owner advanced before checkpoint race'}]});assert.equal(advanced.state,'ready');
   const pause=hold('checkpoint',basis.expression_ref),accept=local.guard(),prior=row.work.state;
   const advancing=row.work.advanceClean(local.store.document,accept),refused=assert.rejects(advancing,/newer native checkpoint was returning/);
   await waitGate(pause,advancing);local.store.change(doc=>{doc.name='Human edit while genuine checkpoint acknowledgement returns';});const draft=structuredClone(local.store.document);
   pause.release.resolve();await refused;gate=undefined;
   assert.deepEqual(row.work.state,prior);assert.deepEqual(local.store.document,draft);assert.equal(local.store.undoStack.length,1);
   const retained=await operation('expression_recovery',{operation:'read',scope:'expressions',kind:'checkpoint',id:prior.draft_id});
   assert.equal(retained.record.value.view.document.revision,advanced.document.revision,'acknowledged checkpoint remains separate recovery data');
   assert.deepEqual((await expression({operation:'inspect',expression_ref:basis.expression_ref})).document,advanced.document);
   effects.push({operation:'checkpoint-race',expression_ref:basis.expression_ref,retained_revision:prior.view.document.revision,checkpoint_revision:advanced.document.revision});
  });

  await t.test('real adopt and reopen deliveries retain an edited draft and a later exact native basis',async()=>{
   const a=await create('adoption A'),b=await create('adoption B'),c=await create('adoption C'),work=working();
   work.restore(a.record,a.view.journey);let store=new DocumentStore(a.view.journey),generation=1;
   const host={snapshot:()=>({journey:store.document,sceneId:store.document.scenes[0].id,entityId:null}),version:()=>store.revision};
   const select=row=>{generation++;work.detach();store=new DocumentStore(row.view.journey);work.restore(row.record,store.document);};
   for(const method of ['adopt','reopen']){
    select(a);let pause=hold(method==='adopt'?'checkpoint':'expression',b.document.expression_ref);
    let accept=captureNativeAdoption(host,()=>generation),returning=method==='adopt'?work.adopt(b.document,undefined,accept):work.reopenCheckpoint(b.record,b.view.journey,accept);
    let rejected=assert.rejects(returning,/selected draft changed/);await waitGate(pause,returning);
    store.change(doc=>{doc.name=`Retained human edit during ${method}`;});pause.release.resolve();await rejected;gate=undefined;
    assert.equal(work.state.view.document.expression_ref,a.document.expression_ref);assert.equal(store.document.name,`Retained human edit during ${method}`);
    select(a);pause=hold(method==='adopt'?'checkpoint':'expression',b.document.expression_ref);accept=captureNativeAdoption(host,()=>generation);
    returning=method==='adopt'?work.adopt(b.document,undefined,accept):work.reopenCheckpoint(b.record,b.view.journey,accept);
    rejected=assert.rejects(returning,/selected draft changed/);await waitGate(pause,returning);select(c);const selected=work.state;
    pause.release.resolve();await rejected;gate=undefined;assert.deepEqual(work.state,selected);
   }
   assert.deepEqual((await expression({operation:'inspect',expression_ref:b.document.expression_ref})).document,b.document);
  });
  const after=await operation('expression_world',{operation:'material_list',kind:'scene'});assert.equal(after.state,'materials');
  assert.equal(after.materials.find(item=>item.file_ref===chosen.file_ref)?.revision,chosen.revision,'the real material register source revision stays unchanged');
 }finally{
  for(const pause of gates)pause.release.resolve();gate=undefined;
  await Promise.allSettled([...deliveries]);
  console.info('native material owner effects before retirement',JSON.stringify({candidate:url,effects,owned_expression_refs:refs,owned_checkpoint_ids:[...checkpointIds],owned_act_refs:[...acts]}));
  // Act archive is the native retirement operation; it intentionally retains
  // the test's durable receipt. Never remove native store files by hand.
  for(const act_ref of acts){
   const inspected=await operation('expression_world',{operation:'act_inspect',act_ref});assert.equal(inspected.state,'act');
   if(!['completed','cancelled'].includes(inspected.act.phase)){
    const owner=await expression({operation:'inspect',expression_ref:inspected.act.expression_ref});
    const ended=await operation('expression_world',{operation:'act_complete',act_ref,actor,cancelled:true,expected_act_revision:inspected.act.revision,expected_revision:owner.document.revision});
    assert.equal(ended.state,'act_cancelled');
   }
   const archived=await operation('expression_world',{operation:'act_archive',act_ref,actor});assert.equal(archived.state,'act_archived');
  }
  for(const expression_ref of refs){
   const owner=await expression({operation:'inspect',expression_ref});
   const name=`native-material-verification-${expression_ref.slice('expression:material-verification-'.length)}.expression.json`;
   const saved=await expression({operation:'save_as',expression_ref,expected_revision:owner.document.revision,parent:evidenceParent,name,
    operation_ref:`operation:native-material-verification:${crypto.randomUUID()}`,actor,actor_kind:'agent'});
   assert.equal(saved.state,'saved');assert.equal(saved.readback_verified,true);assert.equal(saved.expression_revision,owner.document.revision);
   assert.equal(saved.file.location.root,evidenceParent.root);
   assert.equal(saved.file.location.path,`${evidenceParent.path}/${name}`);
   effects.push({operation:'save_as',expression_ref,revision:owner.document.revision,file:saved.file});
   const clean=await expression({operation:'inspect',expression_ref});assert.deepEqual(clean.document,owner.document);
   const closed=await expression({operation:'close',expression_ref,actor});assert.equal(closed.state,'closed');
  }
  // Recovery checkpoints remain available until every native snapshot has
  // been durably saved and acknowledged closed.
  for(const id of checkpointIds){const read=await operation('expression_recovery',{operation:'read',scope:'expressions',kind:'checkpoint',id});if(read.record){const removed=await operation('expression_recovery',{operation:'remove',scope:'expressions',kind:'checkpoint',id,expected_revision:read.record.revision});assert.equal(removed.state,'removed');}}
  console.info('native material owner effects',JSON.stringify({candidate:url,effects,closed_expression_refs:refs,removed_checkpoint_ids:[...checkpointIds],archived_act_refs:[...acts],standing:'real-owner controller, adoption races and native snapshot save/readback; GPU/UI acceptance pending'}));
 }
});
