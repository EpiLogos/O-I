/** Actual Central Wiki -> production M0 helper -> native Expression owner.
 * Real source read only; Expression writes live in disposable native home.
 * No Stage, browser, substituted owner or generated source specimen. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {kernelOp} from '../src/kernel/bridge.ts';
import {getWikiProjectionState,subscribeWikiProjection} from '../src/techne/wikiProjectionStore.ts';
import {ensureWikiNativeExpression,focusWikiNativeExpression,publishWikiNativeRegisters,selectWikiNativeRegister,selectedWikiNativeRegister} from '../src/techne/wikiNativeExpression.ts';

test('actual Wiki becomes native Scenes with exact identities; repeated open preserves authored edits and selection',{skip:process.env.OI_NATIVE_WIKI_EXPRESSION!=='1',timeout:180000},async()=>{
 for(const name of ['OI_KERNEL_BIN','OI_BIN','OI_AIKIT_BIN','OI_CENTRAL_CTRL_BIN','OI_CENTRAL_ROOT'])assert.ok(process.env[name],`${name} must identify the real source/native route`);
 const home=await mkdtemp(join(tmpdir(),'oi-wiki-native-'));let child,stderr='';
 try{
  child=spawn(process.env.OI_KERNEL_BIN,['127.0.0.1:0'],{env:{...process.env,OI_HOME:home,OI_CENTRAL_PROJECT_QUERY:''},detached:true,stdio:['ignore','pipe','pipe']});child.stderr.on('data',chunk=>stderr+=chunk);
  const url=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(Error(stderr||'Native startup timed out')),30000);child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',code=>{clearTimeout(timer);reject(Error(`Native exited ${code}: ${stderr}`));});child.stdout.on('data',chunk=>{text+=chunk;const match=/listening on (http:\/\/[^ ]+)/.exec(text);if(match){clearTimeout(timer);resolve(match[1]);}});});
  const transport={kind:'bridge',url};
  const expression=async request=>{const result=await kernelOp(transport,{op:'expression',request});assert.equal(result.error,undefined,result.error);assert.equal(result.outcome?.result,'expression');return result.outcome.data;};
  publishWikiNativeRegisters([]);const register=selectWikiNativeRegister('central');assert.equal(selectedWikiNativeRegister().key,'central');assert.throws(()=>selectWikiNativeRegister('undisclosed-project'));
  let sourceReading;
  const stopReading=subscribeWikiProjection(()=>{const standing=getWikiProjectionState().standings[register.key];if(standing?.phase==='projected')sourceReading=standing.reading;});
  let prepared;try{prepared=await ensureWikiNativeExpression(transport,register);}finally{stopReading();}
  const doc=prepared.document;
  if(process.env.OI_NATIVE_WIKI_EVIDENCE_DIR){await mkdir(process.env.OI_NATIVE_WIKI_EVIDENCE_DIR,{recursive:true});await writeFile(join(process.env.OI_NATIVE_WIKI_EVIDENCE_DIR,'wiki-native-artifact.json'),JSON.stringify({source:'Actual Central Wiki through native owner; disposable Expression home',register,reading:sourceReading,document:doc},null,2));}
  assert.equal(doc.schema,'oi.expression/v1');assert.ok(doc.scenes.length>0);assert.equal(doc.expression_ref,prepared.projection.document.expression_ref);assert.deepEqual(doc.scenes.map(scene=>scene.scene_ref),prepared.projection.document.scenes.map(scene=>scene.scene_ref));
  assert.deepEqual((await expression({operation:'inspect',expression_ref:doc.expression_ref})).document,doc,'actual native owner holds the exact projected Scene document');
  assert.ok(doc.provenance.some(row=>row.revision),'actual owner source revision is present');
  const scene=doc.scenes.find(row=>row.entity_refs.length);assert.ok(scene,'the selected real Wiki must disclose at least one actual member');
  const entityRef=scene.entity_refs[0],subject=doc.entities[entityRef].subject;assert.ok(subject?.subject_ref,'member binds its actual native subject');
  const focused=await focusWikiNativeExpression(transport,register,{sceneRef:scene.scene_ref,entityRef});assert.equal(focused.document.selection.scene_ref,scene.scene_ref);assert.equal(focused.document.selection.entity_ref,entityRef);assert.deepEqual(focused.document.entities[entityRef].subject,subject);
  const renamed=await expression({operation:'edit',expression_ref:doc.expression_ref,expected_revision:focused.document.revision,actor:'human:native-m0-regression',changes:[{change:'scene_rename',scene_ref:scene.scene_ref,title:'Retained native scene edit'}]});
  const repeated=await ensureWikiNativeExpression(transport,register);assert.deepEqual(repeated.document,renamed.document,'fresh projection never replaces a standing native authored generation');
  const before=repeated.document;await assert.rejects(focusWikiNativeExpression(transport,register,{sceneRef:scene.scene_ref,entityRef:'foreign:member'}),/not a member/);assert.deepEqual((await expression({operation:'inspect',expression_ref:doc.expression_ref})).document,before,'refused focus changes no native composition');
  const alternate=doc.scenes.find(row=>row.scene_ref!==scene.scene_ref)??scene;
  await Promise.all([focusWikiNativeExpression(transport,register,{sceneRef:scene.scene_ref,entityRef}),focusWikiNativeExpression(transport,register,{sceneRef:alternate.scene_ref,entityRef:null})]);
  const ordered=(await expression({operation:'inspect',expression_ref:doc.expression_ref})).document;assert.equal(ordered.selection.scene_ref,alternate.scene_ref);assert.equal(ordered.selection.entity_ref,null,'later native focus wins even when both host requests overlap');
  const listed=await expression({operation:'list'});assert.equal(listed.expressions.filter(row=>row.expression_ref===doc.expression_ref).length,1,'one native construction, no alternate local graph identity');
 }finally{if(child){const exited=child.exitCode===null?once(child,'exit'):null;try{process.kill(-child.pid,'SIGTERM');}catch{}if(exited)await exited;}await rm(home,{recursive:true,force:true});}
});
