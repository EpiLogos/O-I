/** Actual native constellation -> native Expression subject bindings -> Scene
 * reading. All authoring uses a disposable Central root and native owners. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,mkdir,rm,readFile as readBytes} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {kernelOp} from '../src/kernel/bridge.ts';
import {readRegister,CONSTRUCTION} from '../src/knowledge/construction.ts';
import {projectConstruction} from '../src/knowledge/constructionProjection.ts';
import {publishWikiNativeRegisters} from '../src/techne/wikiNativeExpression.ts';
import {readWikiSceneTechne,resolveSceneConstellation} from '../src/techne/wikiReadingProvider.ts';

test('authored constellation carries exact register/frame basis into existing native subject bindings',{skip:process.env.OI_NATIVE_AUTHORED_SCENE!=='1',timeout:180000},async()=>{
 for(const key of ['OI_KERNEL_BIN','OI_BIN','OI_AIKIT_BIN','OI_CENTRAL_CTRL_BIN'])assert.ok(process.env[key],key+' must name the actual candidate');
 const scratch=await mkdtemp(join(tmpdir(),'oi-authored-scene-')),root=join(scratch,'Central'),home=join(scratch,'oi-home');let child,stderr='';
 const env={...process.env,OI_HOME:home,AIKIT_HOME:join(scratch,'aikit-home'),OI_CENTRAL_ROOT:root,OI_CENTRAL_PROJECT_QUERY:''};
 try{
  await mkdir(root);await mkdir(home);
  const init=JSON.parse(execFileSync(process.env.OI_CENTRAL_CTRL_BIN,['--root',root,'--json','action','run','central.init','{}'],{env,encoding:'utf8',timeout:30000}));assert.equal(init.ok,true,JSON.stringify(init));
  child=spawn(process.env.OI_KERNEL_BIN,['127.0.0.1:0'],{env,detached:true,stdio:['ignore','pipe','pipe']});child.stderr.on('data',chunk=>stderr+=chunk);
  const url=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error(stderr||'Native startup timed out')),30000);child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',code=>{clearTimeout(timer);reject(Error('Native exited '+code+stderr));});child.stdout.on('data',chunk=>{output+=chunk;const match=/listening on (http:\/\/[^ ]+)/.exec(output);if(match){clearTimeout(timer);resolve(match[1]);}});});
  const transport={kind:'bridge',url};
  const before=await readRegister(transport);assert.ok(before.spaces.length,'native Central initialization supplies its root Wiki space');
  const subject=before.spaces[0].ref;
  const frameRef='wiki:frame:native-authored-scene',request={schema:'aikit.constellation-action/v1',frame_ref:frameRef,expected_revision:0,actor_ref:'human:native-regression',operation_ref:'operation:wiki:native-authored-scene',changes:[{change:'create',anchor_ref:'wiki:anchor:native-authored-scene',title:'Native Scene scope',inquiry:{question:'Does this native source binding survive projection?'},space_refs:[subject],frame:null},{change:'member_add',member:{subject_ref:subject,participation:{participation_ref:'participation:wiki:native-scope',role_ref:null,sources:[],note:'Actual root space'}}}]};
  const apply=JSON.parse(execFileSync(process.env.OI_AIKIT_BIN,['--json','-C',root,'wiki-construct','apply','--file',join(root,before.file.location.path)],{env,input:JSON.stringify({basis_content:before.file.content,request}),encoding:'utf8',timeout:30000}));assert.ok(apply.ok,JSON.stringify(apply));
  const register=await readRegister(transport),frame=register.frames.find(row=>row.ref===frameRef);assert.ok(frame);assert.equal(frame[CONSTRUCTION].title,'Native Scene scope');
  const opened=await projectConstruction(transport,undefined,frame,register.relations,register);assert.equal(opened.state,'ready',JSON.stringify(opened));
  const doc=opened.document,basis={ref:'wiki:'+register.file.location.path,revision:register.file.revision,availability:'available'};
  for(const entity of Object.values(doc.entities))assert.deepEqual(entity.subject.readings.find(row=>row.ref===basis.ref),basis);
  publishWikiNativeRegisters([]);
  const requestReading={expression_ref:doc.expression_ref,revision:doc.revision,scene_ref:doc.selection.scene_ref};
  const occurrence=Object.values(doc.entities)[0].entity_ref;
  const editorRequest={...requestReading,entity_ref:occurrence};
  assert.deepEqual(await resolveSceneConstellation(transport,editorRequest),{frame_ref:frameRef,frame_revision:frame.revision,title:'Native Scene scope',project:undefined});
  await assert.rejects(resolveSceneConstellation(transport,{...editorRequest,revision:doc.revision+1}),/revision changed/);
  await assert.rejects(resolveSceneConstellation(transport,{...editorRequest,scene_ref:'scene:absent'}),/Scene is absent/);
  await assert.rejects(resolveSceneConstellation(transport,{...editorRequest,entity_ref:'entity:absent'}),/not a source-bound member/);
  const reading=await readWikiSceneTechne(transport,requestReading);assert.equal(reading.snapshot.revision,register.file.revision);assert.deepEqual(reading.whole.member_refs,[subject]);
  assert.equal(reading.expressions[0].expression_ref,doc.expression_ref,'authored identity is not required to equal generated Wiki projection identity');
  // Explicit Open live composition upgrades an old document's bindings;
  // ordinary reading never manufactures its absent source provenance.
  const entity=Object.values(doc.entities)[0];
  const legacy=await kernelOp(transport,{op:'expression',request:{operation:'edit',expression_ref:doc.expression_ref,expected_revision:doc.revision,actor:'human:native-regression',changes:[{change:'subject_bind',entity_ref:entity.entity_ref,binding:{...entity.subject,readings:entity.subject.readings.filter(row=>row.ref!==basis.ref)}}]}});
  assert.equal(legacy.error,undefined);const legacyDoc=legacy.outcome.data.document;
  await assert.rejects(resolveSceneConstellation(transport,{...editorRequest,revision:legacyDoc.revision}),/source editor.*Open live composition/);
  await assert.rejects(readWikiSceneTechne(transport,{...requestReading,revision:legacyDoc.revision}),/source editor.*Open live composition/);
  const reopened=await projectConstruction(transport,undefined,frame,register.relations,register);assert.equal(reopened.state,'ready');
  const upgraded=await readWikiSceneTechne(transport,{...requestReading,revision:reopened.document.revision});assert.equal(upgraded.snapshot.revision,register.file.revision);
  await assert.rejects(projectConstruction(transport,undefined,{...frame,revision:frame.revision+1},register.relations,register),/exact register basis/);
  const raw=await readBytes(join(root,register.file.location.path),'utf8');assert.equal(raw,register.file.content,'projection and instrument reads never mutate the native source register');
  const renamed={...request,expected_revision:frame.revision,operation_ref:'operation:wiki:native-editor-rename',changes:[{change:'inquiry_set',title:'Updated owner title',inquiry:{question:'Does the stale editor handoff refuse?'}}]};
  const changed=JSON.parse(execFileSync(process.env.OI_AIKIT_BIN,['--json','-C',root,'wiki-construct','apply','--file',join(root,register.file.location.path)],{env,input:JSON.stringify({basis_content:raw,request:renamed}),encoding:'utf8',timeout:30000}));assert.ok(changed.ok,JSON.stringify(changed));
  await assert.rejects(resolveSceneConstellation(transport,{...editorRequest,revision:reopened.document.revision}),/source register changed/);
 }finally{if(child){const stopped=child.exitCode===null?once(child,'exit'):null;try{process.kill(-child.pid,'SIGTERM');}catch{}if(stopped)await stopped;}await rm(scratch,{recursive:true,force:true});}
});
