/** Production recovery planner over an actual captured native Wiki reading.
 * No generated Wiki, substituted owner, browser, or semantic inference. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {planWikiRelationRecovery} from '../src/techne/wikiNativeExpression.ts';
import {projectWikiExpression} from '../src/techne/wikiExpression.ts';
const path=process.env.OI_NATIVE_WIKI_ARTIFACT;
test('actual native Wiki recovery preserves material, refuses changed endpoints and never treats intentional deletion as incomplete reading',{skip:!path},async()=>{
 const {reading,register}=JSON.parse(await readFile(path,'utf8'));
 assert.equal(reading.state,'ready');assert.equal(reading.relations.state,'available');
 const fresh=projectWikiExpression(reading);assert.ok(fresh.boundRelationCount>0,'native source must actually disclose connections');
 // Reproduce the real failed acquisition through the production projection.
 const initial=projectWikiExpression({...reading,relations:{state:'unavailable',focusRef:reading.relations.focusRef,reason:'Native owner exceeded its read deadline'}}).document;
 assert.equal(Object.keys(initial.relations).length,0);
 const before=JSON.stringify(initial),review=planWikiRelationRecovery(register,initial,fresh);
 assert.equal(review.missing.length,fresh.boundRelationCount);assert.equal(JSON.stringify(initial),before,'review mutates no native material');
 const authored=structuredClone(initial);authored.revision=7;authored.title='Retained authored composition';authored.scenes[0].title='Retained authored Scene';authored.selection={scene_ref:authored.scenes[0].scene_ref,entity_ref:authored.scenes[0].entity_refs[0]};
 const entity=authored.entities[review.missing[0].from_entity_ref];entity.parameters.x.value=42;
 const authoredBytes=JSON.stringify(authored);assert.equal(planWikiRelationRecovery(register,authored,fresh).missing.length,review.missing.length);assert.equal(JSON.stringify(authored),authoredBytes);
 const complete=structuredClone(fresh.document);delete complete.relations[review.missing[0].binding_ref];
 assert.throws(()=>planWikiRelationRecovery(register,complete,fresh),/intentionally removed/);
 const rebound=structuredClone(initial);rebound.entities[review.missing[0].from_entity_ref].subject.subject_ref='wiki:another-native-subject';
 assert.throws(()=>planWikiRelationRecovery(register,rebound,fresh),/removed or rebound/);
 const moved=structuredClone(initial);for(const scene of moved.scenes)scene.entity_refs=scene.entity_refs.filter(ref=>ref!==review.missing[0].to_entity_ref);
 assert.throws(()=>planWikiRelationRecovery(register,moved,fresh),/Scene membership changed/);
 const conflict=structuredClone(initial);conflict.relations[review.missing[0].binding_ref]={...review.missing[0],to_entity_ref:review.missing[0].from_entity_ref};
 assert.throws(()=>planWikiRelationRecovery(register,conflict,fresh),/identity has changed/);
 const unavailable=projectWikiExpression({...reading,relations:{state:'unavailable',focusRef:reading.relations.focusRef,reason:'Actual owner unavailable'}});
 assert.throws(()=>planWikiRelationRecovery(register,initial,unavailable),/Actual owner unavailable/);
 const changed=structuredClone(initial);changed.provenance[0].revision+='changed';
 assert.throws(()=>planWikiRelationRecovery(register,changed,fresh),/Wiki source changed/);
 const applied=structuredClone(initial);applied.relations=Object.fromEntries(review.missing.map(row=>[row.binding_ref,row]));assert.equal(planWikiRelationRecovery(register,applied,fresh).missing.length,0,'a repeated review is idempotent');
});

test('real native owner restores captured source connections with CAS and readback while retaining authored work',{skip:!path||!process.env.OI_KERNEL_BIN,timeout:90000},async()=>{
 const {spawn}=await import('node:child_process'),{once}=await import('node:events'),{mkdtemp,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path');
 const {kernelOp}=await import('../src/kernel/bridge.ts');
 const {commitWikiRelationRecovery}=await import('../src/techne/wikiNativeExpression.ts');
 const {reading,register}=JSON.parse(await readFile(path,'utf8'));const projection=projectWikiExpression(reading);
 const failed=projectWikiExpression({...reading,relations:{state:'unavailable',focusRef:reading.relations.focusRef,reason:'Native owner exceeded its read deadline'}}).document;
 const home=await mkdtemp(join(tmpdir(),'oi-native-relation-recovery-'));let child,stderr='';
 try{
  child=spawn(process.env.OI_KERNEL_BIN,['127.0.0.1:0'],{env:{...process.env,OI_HOME:home,OI_CENTRAL_PROJECT_QUERY:''},detached:true,stdio:['ignore','pipe','pipe']});child.stderr.on('data',chunk=>stderr+=chunk);
  const url=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error(stderr||'Native startup timed out')),30000);child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',code=>{clearTimeout(timer);reject(Error(`Native exited ${code}: ${stderr}`));});child.stdout.on('data',chunk=>{output+=chunk;const match=/listening on (http:\/\/[^ ]+)/.exec(output);if(match){clearTimeout(timer);resolve(match[1]);}});});
  const transport={kind:'bridge',url};const operation=async request=>{const reply=await kernelOp(transport,{op:'expression',request});assert.equal(reply.error,undefined,reply.error);assert.equal(reply.outcome?.result,'expression');return reply.outcome.data;};
  const opened=await operation({operation:'open',document:failed,actor:'human:recovery-regression'});
  const first=Object.values(projection.document.relations)[0],scene=failed.scenes.find(row=>row.entity_refs.includes(first.from_entity_ref)&&row.entity_refs.includes(first.to_entity_ref));
  const authored=await operation({operation:'edit',expression_ref:failed.expression_ref,expected_revision:opened.document.revision,actor:'human:recovery-regression',changes:[{change:'scene_rename',scene_ref:scene.scene_ref,title:'Authored Scene retained'},{change:'parameter_set',entity_ref:first.from_entity_ref,parameter:'x',value:42},{change:'focus',scene_ref:scene.scene_ref,entity_ref:first.from_entity_ref}]});
  const preview=planWikiRelationRecovery(register,authored.document,projection);
  const restored=await commitWikiRelationRecovery(transport,preview,projection);
  assert.equal(Object.keys(restored.relations).length,projection.boundRelationCount);
  assert.deepEqual(restored.scenes,authored.document.scenes);assert.deepEqual(restored.entities,authored.document.entities);assert.deepEqual(restored.selection,authored.document.selection);
  assert.deepEqual((await operation({operation:'inspect',expression_ref:failed.expression_ref})).document,restored);
  await assert.rejects(commitWikiRelationRecovery(transport,preview,projection),/changed after review/,'stale reviewed revision cannot replay over current owner');
  assert.deepEqual((await operation({operation:'inspect',expression_ref:failed.expression_ref})).document,restored);
 }finally{if(child){const exited=child.exitCode===null?once(child,'exit'):null;try{process.kill(-child.pid,'SIGTERM');}catch{}if(exited)await exited;}await rm(home,{recursive:true,force:true});}
});
