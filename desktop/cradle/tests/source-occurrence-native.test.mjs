/** Actual native source projection, occurrence CAS and delivery-loss recovery.
 * The optional filesystem checkpoint mode exercises actual disk writes but is
 * not evidence for the native recovery store; the default uses that owner. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {kernelOp} from '../src/kernel/bridge.ts';
import {readRegister} from '../src/knowledge/construction.ts';
import {projectConstruction} from '../src/knowledge/constructionProjection.ts';
import {verifyInsertionSource} from '../src/expressions/sourceInsertion.ts';

test('native source duplication and insertion preserve exact bindings/material, refuse stale CAS and recover without replay',{skip:process.env.OI_NATIVE_SOURCE_OCCURRENCE!=='1',timeout:120000},async()=>{
 for(const key of ['OI_KERNEL_BIN','OI_BIN','OI_AIKIT_BIN','OI_CENTRAL_CTRL_BIN'])assert.ok(process.env[key],key+' required');
 const scratch=await mkdtemp(join(tmpdir(),'oi-source-occurrence-')),root=join(scratch,'Central'),home=join(scratch,'oi-home');let child,stderr='';
 const env={...process.env,CENTRAL_ROOT:root,OI_CENTRAL_ROOT:root,OI_HOME:home,AIKIT_HOME:join(scratch,'aikit-home'),OI_CENTRAL_PROJECT_QUERY:''};
 try{
  await mkdir(root);await mkdir(home);
  assert.equal(JSON.parse(execFileSync(process.env.OI_CENTRAL_CTRL_BIN,['--root',root,'--json','action','run','central.init','{}'],{env,encoding:'utf8',timeout:30000})).ok,true);
  child=spawn(process.env.OI_KERNEL_BIN,['127.0.0.1:0'],{env,detached:true,stdio:['ignore','pipe','pipe']});child.stderr.on('data',chunk=>stderr+=chunk);
  const url=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error(stderr||'Native startup timed out')),30000);child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',code=>{clearTimeout(timer);reject(Error('Native exited '+code+stderr));});child.stdout.on('data',chunk=>{output+=chunk;const match=/listening on (http:\/\/[^ ]+)/.exec(output);if(match){clearTimeout(timer);resolve(match[1]);}});});
  const transport={kind:'bridge',url};
  const operation=async(op,request)=>{const result=await kernelOp(transport,{op,request});assert.equal(result.error,undefined,result.error);assert.equal(result.outcome?.result,op);return result.outcome.data;};
  let mutations=0,loseNext=false;
  const expression=async request=>{if(request.operation==='edit')mutations++;const value=await operation('expression',request);if(loseNext&&request.operation==='edit'){loseNext=false;throw Error('Test delivery loss after actual owner acknowledgement');}return value;};
  const before=await readRegister(transport),subject=before.spaces[0].ref,frameRef='wiki:frame:occurrence-proof';
  const parts=['participation:wiki:occurrence-a','participation:wiki:occurrence-b'];
  const request={schema:'aikit.constellation-action/v1',frame_ref:frameRef,expected_revision:0,actor_ref:'human:native-occurrence-regression',operation_ref:'operation:wiki:occurrence-proof',changes:[{change:'create',anchor_ref:'wiki:anchor:occurrence-proof',title:'Occurrence preservation',inquiry:{question:'Does another occurrence retain its source exactly?'},space_refs:[subject],frame:null},...parts.map(part=>({change:'member_add',member:{subject_ref:subject,participation:{participation_ref:part,role_ref:null,sources:[],note:'Same source, distinct participation'}}})),{change:'relation_put',relation:{relation_ref:'wiki:edge:occurrence-proof',expected_revision:null,from_participation_ref:parts[0],to_participation_ref:parts[1],relation:'supports',direction:'directed',standing:'asserted',evidence:[]}}]};
  const apply=JSON.parse(execFileSync(process.env.OI_AIKIT_BIN,['--json','-C',root,'wiki-construct','apply','--file',join(root,before.file.location.path)],{env,input:JSON.stringify({basis_content:before.file.content,request}),encoding:'utf8',timeout:30000}));assert.ok(apply.ok,JSON.stringify(apply));
  const current=await readRegister(transport),frame=current.frames.find(row=>row.ref===frameRef),sourceBytes=await readFile(join(root,current.file.location.path));
  const opened=await projectConstruction(transport,undefined,frame,current.relations,current);assert.equal(opened.state,'ready',JSON.stringify(opened));
  const built=await build({stdin:{contents:"export {NativeWorking} from './nativeWorking.ts';",resolveDir:fileURLToPath(new URL('../expressions-app/field-studies-journeys/src/',import.meta.url)),loader:'ts'},bundle:true,platform:'node',format:'esm',target:'node22',write:false,logLevel:'silent'});
  const {NativeWorking}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
  let retained,storeRevision=null;
  const checkpoint=async(id,value)=>{
   if(process.env.OI_NATIVE_OCCURRENCE_CHECKPOINT==='file'){const path=join(scratch,'checkpoint.json');await writeFile(path,JSON.stringify(value));retained=JSON.parse(await readFile(path,'utf8'));}
   else {const out=await operation('expression_recovery',{operation:'write',scope:'techne',kind:'checkpoint',id,expected_revision:storeRevision,value});assert.equal(out.state,'written',JSON.stringify(out));storeRevision=out.record.revision;retained=out.record.value;}
  };
  const make=()=>new NativeWorking({expression,checkpoint,file:async()=>assert.fail('No source or canonical file publication'),mint:()=>assert.fail('No new Expression identity')});
  let work=make(),view=await work.adopt(opened.document),scene=view.document.scenes.find(row=>row.scene_ref===view.document.selection.scene_ref),source=scene.entity_refs[0],reference=view.document.expression_ref;
  const configured=await expression({operation:'edit',expression_ref:reference,expected_revision:view.document.revision,actor:'human:native-occurrence-regression',changes:[{change:'parameter_set',entity_ref:source,parameter:'scale',value:0.75},{change:'parameter_automate',entity_ref:source,parameter:'scale',automation:{min:0.25,max:0.9,rate_hz:0.1,waveform:'sine'}}]});
  view=await work.adopt(configured.document);
  const local=structuredClone(view.journey),visible=local.scenes.find(row=>view.bindings[row.id]?.scene_ref===scene.scene_ref),original=visible.entities.find(row=>row.id===view.entity_ids[source]);
  assert.ok(original);original.position.x=0.3;original.scale=1.4;
  await work.commit({journey:local,sceneId:visible.id,entityId:original.id});
  view=work.state.view;const basis=structuredClone(view.document),newRef=reference+':entity:occurrence-duplicate-proof';
  const duplicated=await work.duplicateOccurrence({operation:'duplicate',scene_ref:scene.scene_ref,entity_ref:source,new_entity_ref:newRef});
  const added=duplicated.document.entities[newRef];assert.deepEqual(added.subject,basis.entities[source].subject);assert.deepEqual(added.parameters,basis.entities[source].parameters);
  assert.deepEqual(duplicated.document.relations,basis.relations,'source relationships are not copied or changed');
  for(const [ref,entity]of Object.entries(basis.entities))assert.deepEqual(duplicated.document.entities[ref],entity);
  const priorScene=basis.scenes.find(row=>row.scene_ref===scene.scene_ref),nextScene=duplicated.document.scenes.find(row=>row.scene_ref===scene.scene_ref);
  const oldMaterial=priorScene.presentation.scene.entities.find(row=>row.id===source),newMaterial=nextScene.presentation.scene.entities.find(row=>row.id===newRef);
  const expectedMaterial=structuredClone(oldMaterial);expectedMaterial.id=newRef;if(expectedMaterial.native)expectedMaterial.native.id=newRef;
  assert.deepEqual(newMaterial,expectedMaterial,'exact occurrence material is retained');
  assert.deepEqual(nextScene.presentation.savedBaseline,priorScene.presentation.savedBaseline,'saved baseline is not repurposed');
  assert.equal(duplicated.document.selection.entity_ref,newRef);assert.equal(work.state.pending,undefined);
  for(const other of basis.scenes.filter(row=>row.scene_ref!==scene.scene_ref))assert.deepEqual(duplicated.document.scenes.find(row=>row.scene_ref===other.scene_ref),other);
  const insertedRef=reference+':entity:occurrence-insert-proof';
  const verified=await verifyInsertionSource(transport,{kind:'projected-object',ref:subject,title:basis.entities[source].title,owner:'ai-kit',scope:'local',provider:'wiki',address:{kind:'wiki',value:subject}});
  const inserted=await work.insertSource({operation:'insert-source',scene_ref:scene.scene_ref,new_entity_ref:insertedRef,...verified});
  assert.deepEqual(inserted.document.entities[insertedRef].subject,verified.binding);assert.equal(inserted.document.entities[insertedRef].parameters.shape.value,'disc');assert.deepEqual(inserted.document.relations,basis.relations);
  const callsBeforeLoss=mutations,lostRef=reference+':entity:occurrence-lost-return';loseNext=true;
  await assert.rejects(work.duplicateOccurrence({operation:'duplicate',scene_ref:scene.scene_ref,entity_ref:source,new_entity_ref:lostRef}),/delivery loss/);
  assert.equal(retained.pending.kind,'occurrence');assert.equal(mutations,callsBeforeLoss+1);
  if(process.env.OI_NATIVE_OCCURRENCE_CHECKPOINT!=='file'){
   for(const invalidRef of [reference+':entity:occurrence-../escape','expression:foreign:entity:occurrence-proof',reference+':entity:occurrence-'+('x'.repeat(129))]){
    const invalid=structuredClone(retained);invalid.pending.intent.new_entity_ref=invalidRef;
    const refused=await kernelOp(transport,{op:'expression_recovery',request:{operation:'write',scope:'techne',kind:'checkpoint',id:invalid.draft_id,expected_revision:storeRevision,value:invalid}});
    assert.match(refused.error??'',/Expression-local ref|outside this Expression/,'malformed or foreign occurrence IDs remain refused');
   }
   const unchanged=await operation('expression_recovery',{operation:'read',scope:'techne',kind:'checkpoint',id:retained.draft_id});
   assert.equal(unchanged.record.revision,storeRevision);assert.deepEqual(unchanged.record.value,retained,'refused IDs cannot overwrite the recoverable acknowledgement');
  }
  const interrupted=structuredClone(retained);work=make();work.restore(interrupted,interrupted.view.journey);
  assert.match(await work.inspectPending(),/Recovered the exact native occurrence/);assert.ok(work.state.view.document.entities[lostRef]);assert.equal(mutations,callsBeforeLoss+1,'recovery inspects; it never repeats the mutation');
  const stale=make();stale.restore(work.state,work.state.view.journey);
  const changed=await expression({operation:'edit',expression_ref:reference,expected_revision:work.state.view.document.revision,actor:'human:native-occurrence-regression',changes:[{change:'rename',title:'Independently changed native work'}]});
  const staleRef=reference+':entity:occurrence-stale-proof';
  await assert.rejects(stale.duplicateOccurrence({operation:'duplicate',scene_ref:scene.scene_ref,entity_ref:source,new_entity_ref:staleRef}),/revision|conflict|changed/i);
  assert.equal((await expression({operation:'inspect',expression_ref:reference})).document.entities[staleRef],undefined);
  assert.equal(stale.state.pending.kind,'occurrence','failed CAS remains available for explicit inspection');
  assert.equal(changed.document.title,'Independently changed native work');assert.deepEqual(await readFile(join(root,current.file.location.path)),sourceBytes,'occurrence operations never rewrite Wiki source bytes');
 }finally{if(child){const stopped=child.exitCode===null?once(child,'exit'):null;try{process.kill(-child.pid,'SIGTERM');}catch{}if(stopped)await stopped;}await rm(scratch,{recursive:true,force:true});}
});
