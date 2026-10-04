/** Actual complete retained Epi Document, native file admission and production
 * NativeWorking reads/saves in an owned disposable Central World. No owner
 * response is substituted. Holding a real completed reply tests late delivery. */
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
import {hostedCompositionFile} from '../src/expressions/hostedComposition.ts';
const enabled=process.env.OI_NATIVE_EPI_CAPTION==='1';
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
test('real native caption correction receives the flushed draft without losing custom material, personal basis or selection',{skip:!enabled,timeout:180000},async()=>{
 for(const key of ['OI_KERNEL_BIN','OI_BIN','OI_CENTRAL_CTRL_BIN'])assert.ok(process.env[key],key+' required');
 const built=await build({stdin:{contents:"export {NativeWorking,nativeOwnerSnapshot} from './nativeWorking.ts';export {prepareCompositionEdit} from './kernelComposition.ts';export {acknowledgeEpiCosmicCaptionGeometry,readEpiWorldRecord,epiCosmicCaptionGeometryCorrection} from './epiWorldProduction.ts';export {EPI_COSMIC_CAPTION_GEOMETRY} from './epiWorldMaterial.ts';",resolveDir:fileURLToPath(new URL('../expressions-app/field-studies-journeys/src/',import.meta.url)),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
 const {NativeWorking,nativeOwnerSnapshot,prepareCompositionEdit,acknowledgeEpiCosmicCaptionGeometry,readEpiWorldRecord,epiCosmicCaptionGeometryCorrection,EPI_COSMIC_CAPTION_GEOMETRY}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
 const scratch=await mkdtemp(join(tmpdir(),'oi-saved-confirmation-')),root=join(scratch,'Central'),home=join(scratch,'oi-home');
 const env={...process.env,OI_HOME:home,OI_DATA_HOME:join(scratch,'oi-data'),OI_CENTRAL_ROOT:root,OI_CENTRAL_PROJECT_QUERY:'controlled-no-project',AIKIT_HOME:join(scratch,'aikit-home')};
 let child,stderr='',gate;
 try{
  const init=JSON.parse(execFileSync(env.OI_CENTRAL_CTRL_BIN,['--root',root,'--json','action','run','central.init','{}'],{env,encoding:'utf8',timeout:30000}));assert.equal(init.ok,true,JSON.stringify(init));
  const relative='Work/Confirmation/epi.expression.json';await mkdir(join(root,'Work/Confirmation'),{recursive:true});
  // Exact declared historical full131 input; first admission is not a claimed save.
  const imported=await readFile(new URL('../kernel/tests/fixtures/epi-world-131.expression.json',import.meta.url));await writeFile(join(root,relative),imported);
  child=spawn(env.OI_KERNEL_BIN,['127.0.0.1:0'],{env,detached:true,stdio:['ignore','pipe','pipe']});child.stderr.on('data',bytes=>stderr+=bytes);
  const url=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(Error(stderr||'Native bridge startup timed out')),30000);child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',code=>{clearTimeout(timer);reject(Error('Native bridge exited '+code+stderr));});child.stdout.on('data',bytes=>{text+=bytes;const match=/listening on (http:\/\/\S+)/.exec(text);if(match){clearTimeout(timer);resolve(match[1]);}});});
  let transport={kind:'bridge',url};const requests=[];
  const operation=async(op,request)=>{const started=performance.now();console.log(JSON.stringify({stage:'native-request-start',op,operation:request.operation,at_ms:started}));const reply=await kernelOp(transport,{op,request});console.log(JSON.stringify({stage:'native-request-end',op,operation:request.operation,elapsed_ms:performance.now()-started}));assert.equal(reply.error,undefined,reply.error);assert.equal(reply.outcome?.result,op);return reply.outcome.data;};
  const expression=async request=>{
   requests.push(request.operation);const reply=await operation('expression',request);
   if(gate?.operation===request.operation){const hold=gate;hold.entered.resolve();await hold.release.promise;}
   return reply;
  };
  let writes=0;
  const checkpoint=async(id,value)=>{const old=await operation('expression_recovery',{operation:'read',scope:'expressions',kind:'checkpoint',id});const saved=await operation('expression_recovery',{operation:'write',scope:'expressions',kind:'checkpoint',id,expected_revision:old.record?.revision??null,value});assert.equal(saved.state,'written');writes++;};
  const work=new NativeWorking({expression,checkpoint,file:request=>hostedCompositionFile(transport,request),mint:()=>assert.fail('A saved basis cannot mint another Expression')});
  const opened=await hostedCompositionFile(transport,{operation:'open',path:relative}),reference=opened.document.expression_ref;
  let head=nativeOwnerSnapshot(await expression({operation:'inspect',expression_ref:reference}),reference);
  assert.deepEqual(head.document,opened.document);assert.deepEqual(head.document.scenes.map(s=>s.entity_refs.length),[32,9,7]);
  let view=await work.adopt(head.document,head.file);
  const position=()=>{const entry=Object.entries(view.bindings).find(([,b])=>b.scene_ref===view.document.selection.scene_ref);assert.ok(entry);return {journey:structuredClone(view.journey),sceneId:entry[0],entityId:view.document.selection.entity_ref?entry[1].occurrences.find(o=>o.entity_ref===view.document.selection.entity_ref)?.view_entity_id??null:null};};
  let snapshot=position(),accepted=true;
  // The production coordinator receives its edit callback only after the
  // submitted draft has committed through the actual NativeWorking owner.
  // Both the local material and the selection must survive that new basis.
  const initialDocument=structuredClone(view.document),initialRecord=readEpiWorldRecord(initialDocument);
  assert.ok(initialRecord);assert.equal(epiCosmicCaptionGeometryCorrection(initialDocument,initialRecord).changes.length,1);
  const personalBinding=Object.entries(view.bindings).find(([,binding])=>binding.scene_ref.endsWith(':scene:personal'));assert.ok(personalBinding);
  let captionDraft=position(),flushedDocument,editRequests=0;
  captionDraft.sceneId=personalBinding[0];captionDraft.entityId=personalBinding[1].occurrences[0].view_entity_id;
  captionDraft.journey.scenes.find(scene=>scene.id===personalBinding[0]).text[0].body+=' Retained local personal concern.';
  const captionPort={expression,presentationRest:()=>true,status:()=>{},edit:async compute=>{
   if(prepareCompositionEdit(view,captionDraft.journey).changes.length||captionDraft.sceneId!==snapshot.sceneId||captionDraft.entityId!==snapshot.entityId){await work.commit(captionDraft);view=work.state.view;}
   flushedDocument=structuredClone(view.document);
   const changes=compute(view.document);editRequests+=changes.length;
   if(changes.length)view=await work.editConnections(changes);
  }};
  // A custom generated caption submitted between inspection and the callback
  // is actual authored material; a no-op still acknowledges the full flush.
  const cosmicBinding=Object.entries(view.bindings).find(([,binding])=>binding.scene_ref.endsWith(':scene:cosmic'));assert.ok(cosmicBinding);
  const customScene=captionDraft.journey.scenes.find(scene=>scene.id===cosmicBinding[0]);
  customScene.text[0].body+=' Controlled authored caption.';
  const customRecord=await acknowledgeEpiCosmicCaptionGeometry(captionPort,initialRecord);
  assert.deepEqual(customRecord,initialRecord);assert.equal(editRequests,0);assert.deepEqual(view.document,flushedDocument);
  assert.ok(view.document.scenes.find(scene=>scene.scene_ref.endsWith(':scene:personal')).presentation.scene.text[0].body.endsWith(' Retained local personal concern.'));
  assert.ok(view.document.scenes[0].presentation.scene.text[0].body.endsWith(' Controlled authored caption.'));
  // Explicitly restore only this controlled test caption through native CAS,
  // retaining its personal draft and selection; ordinary admission cannot do so.
  const cosmicPresentation=structuredClone(view.document.scenes[0].presentation);
  cosmicPresentation.scene.text[0]=structuredClone(initialDocument.scenes[0].presentation.scene.text[0]);
  cosmicPresentation.saved.text[0]=structuredClone(initialDocument.scenes[0].presentation.saved.text[0]);
  view=await work.editConnections([{change:'scene_material_set',scene_ref:view.document.scenes[0].scene_ref,presentation:cosmicPresentation}]);
  snapshot=position();captionDraft=position();captionDraft.journey.name+=' · submitted concern';editRequests=0;
  const captionBasis=structuredClone(view.document),captionRecord=readEpiWorldRecord(captionBasis);
  const corrected=await acknowledgeEpiCosmicCaptionGeometry(captionPort,captionRecord);
  assert.notDeepEqual(flushedDocument,captionBasis,'the original pre-flush full-equality predicate rejects this legitimate native successor');
  assert.equal(editRequests,1);assert.equal(corrected.caption_geometry_adjustment.basis_revision,flushedDocument.revision);
  const expectedCaption=structuredClone(flushedDocument);expectedCaption.revision++;
  const correctedScene=expectedCaption.scenes.find(scene=>scene.scene_ref===corrected.receiving.scene_ref);correctedScene.revision=expectedCaption.revision;
  for(const material of [correctedScene.presentation.scene,correctedScene.presentation.saved])for(const [index,label] of material.text.entries())label.y=EPI_COSMIC_CAPTION_GEOMETRY.after_y[index];
  correctedScene.presentation.scene.epiWorld=corrected;
  assert.deepEqual(view.document,expectedCaption,'every other native Document value, body, relation, private binding and selected scene survives');
  const beforeWrongBasis=structuredClone(view.document),writesBeforeWrongBasis=writes;
  await assert.rejects(acknowledgeEpiCosmicCaptionGeometry(captionPort,{...corrected,person_ref:corrected.person_ref+':foreign'}),/exact native world, person, instance or occasion/);
  assert.deepEqual(view.document,beforeWrongBasis);assert.equal(writes,writesBeforeWrongBasis);
  snapshot=position();await work.saveFile(snapshot,{location:head.file.location,revision:head.file.revision});
  view=work.state.view;snapshot=position();head=nativeOwnerSnapshot(await expression({operation:'inspect',expression_ref:reference}),reference);
  assert.deepEqual(head.document,expectedCaption);assert.equal(head.file.document_revision,expectedCaption.revision);
  console.log(JSON.stringify({caption_native_flushed_basis:true,custom_caption_retained:true,complete_document_equal:true,personal_draft_and_selection_retained:true,foreign_basis_refused:true,scope:'Actual production caption coordinator and complete NativeWorking/native file owner; no browser, installed or GPU proof'}));
 }finally{
  if(gate)gate.release.resolve();
  if(child&&child.exitCode===null){const stopped=once(child,'exit');try{process.kill(-child.pid,'SIGTERM');}catch{}await stopped;}
  await rm(scratch,{recursive:true,force:true});
 }
});
