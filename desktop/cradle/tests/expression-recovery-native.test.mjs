/** Actual native recovery across process restart. Source material is created
 * through the real Expression owner, and every durable write stays inside a
 * disposable OI_HOME. No browser database or substituted owner responses. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {kernelOp} from '../src/kernel/bridge.ts';

test('native recovery preserves exact basis and local material across restart, scopes and concurrent CAS',{
  skip:process.env.OI_NATIVE_EXPRESSION_RECOVERY!=='1',timeout:120000,
},async()=>{
  assert.ok(process.env.OI_KERNEL_BIN,'OI_KERNEL_BIN must name the rebuilt candidate walk-bridge');
  // Transpile the actual production state machine in memory; its .js source
  // imports and parameter properties do not use Node's strip-only TS dialect.
  const {build}=await import('esbuild');
  const built=await build({stdin:{contents:"export {NativeWorking} from './nativeWorking.ts'; export {validateJourney} from './model.ts';",resolveDir:fileURLToPath(new URL('../expressions-app/field-studies-journeys/src/',import.meta.url)),sourcefile:'native-recovery-test-entry.ts',loader:'ts'},bundle:true,platform:'node',format:'esm',target:'node22',write:false,logLevel:'silent'});
  const {NativeWorking,validateJourney}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
  // JSON owner operations omit optional undefined properties; compare every
  // serialisable Journey value against that exact wire material.
  const wireJourney=value=>JSON.parse(JSON.stringify(validateJourney(value)));
  const home=await mkdtemp(join(tmpdir(),'oi-expression-recovery-'));
  let child,transport,stderr='';
  const children=new Set();
  const start=async()=>{
    stderr='';
    child=spawn(process.env.OI_KERNEL_BIN,['127.0.0.1:0'],{env:{...process.env,OI_HOME:home},detached:true,stdio:['ignore','pipe','pipe']});
    children.add(child);
    child.stderr.on('data',chunk=>{stderr+=chunk;});
    const url=await new Promise((resolve,reject)=>{
      let text='';const timer=setTimeout(()=>reject(Error(`Native startup timed out: ${stderr}`)),30000);
      child.once('error',error=>{clearTimeout(timer);reject(error);});
      child.once('exit',code=>{clearTimeout(timer);reject(Error(`Native bridge exited ${code}: ${stderr}`));});
      child.stdout.on('data',chunk=>{text+=chunk;const match=/listening on (http:\/\/[^ ]+)/.exec(text);if(match){clearTimeout(timer);resolve(match[1]);}});
    });
    transport={kind:'bridge',url};
  };
  const stop=async(target=child)=>{
    if(target&&target.exitCode===null){const exited=once(target,'exit');try{process.kill(-target.pid,'SIGTERM');}catch{}await exited;}
    children.delete(target);
  };
  const operation=async(op,request,address=transport)=>{
    const result=await kernelOp(address,{op,request});
    assert.equal(result.error,undefined,result.error);
    assert.equal(result.outcome?.result,op);
    return result.outcome.data;
  };
  const expression=request=>operation('expression',request);
  const recovery=request=>operation('expression_recovery',request);
  const read=(scope,kind,id)=>recovery({operation:'read',scope,kind,id});
  const write=(scope,kind,id,expected_revision,value)=>recovery({operation:'write',scope,kind,id,expected_revision,value});
  const makeWorking=checkpoint=>new NativeWorking({expression,checkpoint,
    file:async()=>{assert.fail('Recovery must not write a canonical Central file');},
    mint:()=>{assert.fail('Reopening an acknowledged basis must not mint another Expression');},
  });
  try{
    await start();
    const reference='expression:native-recovery-test';
    const created=await expression({operation:'create',expression_ref:reference,title:'Native restart material',actor:'human:native-recovery-test'});
    assert.ok(created.document,'the real owner creates the source document');
    const sceneRef=created.document.scenes[0].scene_ref,entityRef=reference+':entity:authored';
    const edited=await expression({operation:'edit',expression_ref:reference,expected_revision:created.document.revision,actor:'human:native-recovery-test',changes:[
      {change:'entity_add',scene_ref:sceneRef,entity_ref:entityRef,title:'Native material'},
      {change:'parameter_set',entity_ref:entityRef,parameter:'glyph',value:'Retained source'},
      {change:'focus',scene_ref:sceneRef,entity_ref:entityRef},
    ]});
    assert.ok(edited.document);
    let checkpointRecord;
    const working=makeWorking(async(id,value)=>{
      const result=await write('expressions','checkpoint',id,checkpointRecord?.revision??null,value);
      assert.equal(result.state,'written');checkpointRecord=result.record;
    });
    const view=await working.adopt(edited.document),id=view.journey.id;
    assert.deepEqual(checkpointRecord.value.view.document,edited.document,'checkpoint is the exact acknowledged native basis');
    const local=structuredClone(view.journey);
    local.name='Unsaved local working title';local.scenes[0].duration=37;
    local.scenes[0].entities[0].position.z=0.375;
    local.scenes[0].entities[0].text='Private local draft, never auto-committed';
    const draft=wireJourney(local);
    const draftWrite=await write('expressions','draft',id,null,draft);
    assert.equal(draftWrite.state,'written');assert.deepEqual(draftWrite.record.value,draft);
    assert.deepEqual((await expression({operation:'inspect',expression_ref:reference})).document,edited.document,'private draft backup does not mutate native composition');

    const otherDraft=wireJourney({...structuredClone(draft),name:'Independent Technè working copy'});
    assert.equal((await write('techne','draft',id,null,otherDraft)).state,'written');
    assert.equal((await recovery({operation:'find_checkpoint',scope:'techne',expression_ref:reference})).record,null,'other aperture cannot find this checkpoint');
    assert.equal((await write('techne','checkpoint',id,null,checkpointRecord.value)).state,'written');
    await stop();await start();

    const found=await recovery({operation:'find_checkpoint',scope:'expressions',expression_ref:reference});
    assert.equal(found.state,'ready');assert.deepEqual(found.record,checkpointRecord);
    const restoredDraft=await read('expressions','draft',id);
    assert.deepEqual(restoredDraft.record,draftWrite.record,'exact local material and CAS revision survive a real process restart');
    assert.deepEqual((await read('techne','draft',id)).record.value,otherDraft,'same id has independent scope material');
    assert.deepEqual((await read('expressions','checkpoint',id)).record.value,checkpointRecord.value,'draft/checkpoint kinds never alias');
    const reopened=makeWorking(async()=>{assert.fail('Read recovery must not silently rewrite its checkpoint');});
    const restored=await reopened.reopenCheckpoint(found.record.value,restoredDraft.record.value);
    assert.deepEqual(restored.document,edited.document,'reopen uses exact acknowledged native source basis');
    assert.deepEqual(restored.journey,draft,'newer local draft remains separate from its acknowledged basis');
    assert.deepEqual((await expression({operation:'inspect',expression_ref:reference})).document,edited.document);

    // A different native aperture advances this exact work while the saved
    // checkpoint still names the old revision. Dirty/interrupted material is
    // never rebased; only a clean checkpoint can follow the current owner.
    const advanced=await expression({operation:'edit',expression_ref:reference,expected_revision:edited.document.revision,actor:'human:other-native-aperture',changes:[
      {change:'rename',title:'Newer native title'},
      {change:'focus',scene_ref:sceneRef,entity_ref:null},
    ]});
    assert.ok(advanced.document);
    const oldCheckpoint=structuredClone(checkpointRecord);
    await assert.rejects(reopened.reopenCheckpoint(oldCheckpoint.value,draft),/revision_conflict/);
    const pending=structuredClone(oldCheckpoint.value);
    pending.pending={kind:'selection',request:{operation:'edit',expression_ref:reference,expected_revision:edited.document.revision,actor:'human:expressions-app',changes:[{change:'focus',scene_ref:sceneRef,entity_ref:null}]}};
    await assert.rejects(reopened.reopenCheckpoint(pending,view.journey),/revision_conflict/);
    assert.deepEqual((await read('expressions','checkpoint',id)).record,oldCheckpoint,'refused recovery preserves its captured checkpoint');
    assert.deepEqual((await read('expressions','draft',id)).record,draftWrite.record,'unsaved local material remains byte-exact');
    await assert.rejects(reopened.reopenCheckpoint(oldCheckpoint.value,view.journey,()=>false),/selected draft changed/);
    assert.deepEqual((await read('expressions','checkpoint',id)).record,oldCheckpoint,'a superseded clean recovery cannot persist its result');
    const refreshed=await working.reopenCheckpoint(oldCheckpoint.value,view.journey);
    assert.deepEqual(refreshed.document,advanced.document);
    assert.equal(refreshed.journey.id,view.journey.id,'refresh preserves the original authoring identity');
    assert.equal(refreshed.journey.name,'Newer native title');
    assert.deepEqual(checkpointRecord.value.view.document,advanced.document,'fresh owner basis passes through native checkpoint CAS');
    const staleRecovery=makeWorking(async(draftId,value)=>{
      const result=await write('expressions','checkpoint',draftId,oldCheckpoint.revision,value);
      assert.equal(result.state,'revision_conflict');
      throw Error('checkpoint revision_conflict');
    });
    await assert.rejects(staleRecovery.reopenCheckpoint(oldCheckpoint.value,view.journey),/checkpoint revision_conflict/);
    assert.equal(staleRecovery.state,undefined,'a failed checkpoint CAS cannot adopt the newer native basis');
    assert.deepEqual((await expression({operation:'inspect',expression_ref:reference})).document,advanced.document,'recovery does not mutate native work');

    const candidates=['First concurrent write','Second concurrent write'].map(name=>wireJourney({...structuredClone(draft),name}));
    // Separate native processes share only the disposable recovery home; this
    // race exercises the storage lock/CAS, not merely one kernel's mutex.
    const originalChild=child,originalTransport=transport;await start();
    const raced=await Promise.all(candidates.map((value,index)=>operation('expression_recovery',{operation:'write',scope:'expressions',kind:'draft',id,expected_revision:draftWrite.record.revision,value},index===0?originalTransport:transport)));
    await stop();child=originalChild;transport=originalTransport;
    assert.equal(raced.filter(row=>row.state==='written').length,1,'exactly one same-revision native CAS wins');
    assert.equal(raced.filter(row=>row.state==='revision_conflict').length,1,'stale concurrent writer is refused');
    const winner=raced.find(row=>row.state==='written').record;
    assert.deepEqual((await read('expressions','draft',id)).record,winner);
    const staleRemove=await recovery({operation:'remove',scope:'expressions',kind:'draft',id,expected_revision:draftWrite.record.revision});
    assert.equal(staleRemove.state,'revision_conflict');
    assert.deepEqual((await read('expressions','draft',id)).record,winner,'stale deletion cannot remove newer local material');
    assert.deepEqual((await read('techne','draft',id)).record.value,otherDraft,'writes in Expressions cannot change Technè recovery');
    const listing=await recovery({operation:'list',scope:'expressions',kind:'draft'});
    assert.equal(listing.state,'listed');assert.equal(listing.records.length,1);
    assert.equal(listing.records[0].id,id);assert.equal(Object.hasOwn(listing.records[0],'value'),false,'inventory discloses metadata without draft body');
    const removed=await recovery({operation:'remove',scope:'expressions',kind:'draft',id,expected_revision:winner.revision});
    assert.equal(removed.state,'removed');assert.equal((await read('expressions','draft',id)).record,null);
    assert.deepEqual((await read('expressions','checkpoint',id)).record,checkpointRecord,'removing a draft does not remove its independent checkpoint');
  }finally{await Promise.all([...children].map(target=>stop(target)));await rm(home,{recursive:true,force:true});}
});
