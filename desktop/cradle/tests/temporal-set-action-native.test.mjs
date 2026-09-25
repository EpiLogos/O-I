/** Canonical participation TemporalSet through the actual O:I Action, Central source read and
 * native Wiki writer. All writes are inside a disposable World. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,mkdir,readFile,realpath,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {kernelOp} from '../src/kernel/bridge.ts';
import {readRegister,invoke} from '../src/knowledge/construction.ts';
import {readFile as readNativeFile} from '../src/files/client.ts';
import {projectConstruction} from '../src/knowledge/constructionProjection.ts';
import {knowledgeEntityRef} from '../src/knowledge/expressionProjection.ts';
import {readWikiSceneTechne} from '../src/techne/wikiReadingProvider.ts';
import {publishWikiNativeRegisters} from '../src/techne/wikiNativeExpression.ts';
import {readWikiTemporal,resolveSceneTemporalFacets} from '../src/techne/temporalFacets.ts';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';

test('native TemporalSet Action reaches only its exact participation in Scene Timeline and preserves place facts',{skip:process.env.OI_NATIVE_TEMPORAL_SET_ACTION!=='1',timeout:120000},async()=>{
 for(const key of ['OI_KERNEL_BIN','OI_BIN','OI_AIKIT_BIN','OI_CENTRAL_CTRL_BIN'])assert.ok(process.env[key],key+' required');
 const scratch=await realpath(await mkdtemp(join(tmpdir(),'oi-temporal-set-action-'))),root=join(scratch,'Central'),home=join(scratch,'oi-home');let child,stderr='';
 const env={...process.env,CENTRAL_ROOT:root,OI_CENTRAL_ROOT:root,OI_HOME:home,AIKIT_HOME:join(scratch,'aikit-home'),OI_CENTRAL_PROJECT_QUERY:''};
 const central=(action,input)=>{const out=JSON.parse(execFileSync(process.env.OI_CENTRAL_CTRL_BIN,['--root',root,'--json','action','run',action,JSON.stringify(input)],{env,encoding:'utf8',timeout:30000}));assert.equal(out.ok,true,JSON.stringify(out));return out.data;};
 try{
  await mkdir(root);await mkdir(home);central('central.init',{});await mkdir(join(root,'Work/PlaceProof'),{recursive:true});
  const parent=central('central.files.list',{path:'Work/PlaceProof'}).location;
  const admitted=central('central.files.create',{parent,name:'survey.txt',content:'Synthetic test source declares point [-0.09,51.51] and occurrence2024-06-03T10:30:00Z.',expected_absent:true,operation_ref:'native:place-source',actor:'native-regression',actor_kind:'human'});
  child=spawn(process.env.OI_KERNEL_BIN,['127.0.0.1:0'],{env,detached:true,stdio:['ignore','pipe','pipe']});child.stderr.on('data',chunk=>stderr+=chunk);
  const url=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error(stderr||'Native startup timed out')),30000);child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',code=>{clearTimeout(timer);reject(Error('Native exited '+code+stderr));});child.stdout.on('data',chunk=>{output+=chunk;const match=/listening on (http:\/\/[^ ]+)/.exec(output);if(match){clearTimeout(timer);resolve(match[1]);}});});
  publishWikiNativeRegisters([]);
  const transport={kind:'bridge',url},source=await readNativeFile(transport,admitted.location),register=await readRegister(transport);
  const basis={source_ref:source.source?.ref??source.location.ref,revision:source.revision,location:source.location};
  const frameRef='wiki:frame:place-action',participation='participation:wiki:place-action';
  const request={schema:'aikit.constellation-action/v1',frame_ref:frameRef,expected_revision:0,actor_ref:'human:native-place-action-regression',operation_ref:'operation:wiki:place-action-create',changes:[{change:'create',anchor_ref:'wiki:anchor:place-action',title:'Native PlaceSet Action',inquiry:{question:'Does canonical location metadata retain its verified source?'},space_refs:[register.spaces[0].ref],frame:null},{change:'member_add',member:{subject_ref:register.spaces[0].ref,participation:{participation_ref:participation,role_ref:null,sources:[],note:'Placed native participation'}}}]};
  request.changes.push({change:'member_add',member:{subject_ref:register.spaces[0].ref,participation:{participation_ref:participation+'-undated',role_ref:null,sources:[],note:'Same source in another participation'}}});
  const created=await invoke(transport,undefined,'aikit.constellation.apply',frameRef,{location:register.file.location,expected_file_revision:register.file.revision,request,sources:[]});assert.equal(created.persisted,true);
  let current=await readRegister(transport),frame=current.frames.find(row=>row.ref===frameRef);
  const place={place_ref:'wiki:place:action-proof',geometry:{type:'point',coordinates:[-0.09,51.51]},precision:'exact',source_ref:basis.source_ref};
  const proposal={...request,expected_revision:frame.revision,operation_ref:'operation:wiki:place-action-set',changes:[{change:'place_set',participation_ref:participation,places:[place]}]};
  const bytes=await readFile(join(root,current.file.location.path));
  const action=async(sources,submitted=proposal)=>{const response=await kernelOp(transport,{op:'invoke_action',invocation:{action:'aikit.constellation.apply',target_ref:frameRef,input:{location:current.file.location,expected_file_revision:current.file.revision,request:submitted,sources}}});assert.equal(response.error,undefined,response.error);assert.equal(response.outcome?.result,'action_dispatched');return response.outcome.dispatch;};
  for(const sources of [[],[basis,basis],[basis,{...basis,revision:'another-revision'}]]){
   const refused=await action(sources);assert.equal(refused.state,'owner_refused');assert.match(refused.message,/unique disclosed source basis/);assert.deepEqual(await readFile(join(root,current.file.location.path)),bytes,'basis refusal does not write Wiki');
  }
  const stale=await action([{...basis,revision:'stale-observed-revision'}]);assert.equal(stale.state,'owner_refused');assert.match(stale.message,/source_revision_conflict/);assert.deepEqual(await readFile(join(root,current.file.location.path)),bytes);
  const nested=structuredClone(proposal);nested.changes[0].places[0].provenance=[{source_ref:basis.source_ref}];const denied=await action([basis],nested);assert.equal(denied.state,'owner_refused');assert.match(denied.message,/exact owner revision/,'the PlaceFacet exception does not exempt nested evidence');
  const saved=await action([basis]);assert.equal(saved.state,'invoked',JSON.stringify(saved));assert.equal(saved.data.persisted,true);assert.equal(saved.data.state,'saved');
  current=await readRegister(transport);frame=current.frames.find(row=>row.ref===frameRef);
  assert.deepEqual(frame.constellations[0].members[0]['aikit.techne-facet/v1'].spatial,[place],'canonical facet persisted without an illegal source_revision field');
  assert.equal((await readNativeFile(transport,source.location)).revision,basis.revision,'source material remains unchanged');
  assert.ok(!saved.data.continuity_warnings.some(row=>/source_revision_conflict/.test(row)),'fresh source survived post-write native readback');
  const temporal=[{kind:'occurrence',instant:'2024-06-03T10:30:00Z',precision:'minute',source_ref:basis.source_ref},{kind:'valid',interval:{from:'2024-01-01T00:00:00Z',to:'2024-12-31T23:59:59Z',from_precision:'year',to_precision:'second'},source_ref:basis.source_ref}];
  const timeRequest={...request,expected_revision:frame.revision,operation_ref:'operation:wiki:temporal-action-set',changes:[{change:'temporal_set',participation_ref:participation,temporal}]};
  const beforeTime=await readFile(join(root,current.file.location.path));
  for(const sources of [[],[basis,basis],[{...basis,revision:'stale-observed-revision'}]]){
   const denied=await action(sources,timeRequest);assert.equal(denied.state,'owner_refused');assert.match(denied.message,/unique disclosed source basis|source_revision_conflict/);assert.deepEqual(await readFile(join(root,current.file.location.path)),beforeTime);
  }
  const timeSaved=await action([basis],timeRequest);assert.equal(timeSaved.state,'invoked',JSON.stringify(timeSaved));assert.equal(timeSaved.data.persisted,true);
  current=await readRegister(transport);frame=current.frames.find(row=>row.ref===frameRef);
  const member=frame.constellations[0].members[0];assert.deepEqual(member['aikit.techne-facet/v1'].temporal,temporal);assert.deepEqual(member['aikit.techne-facet/v1'].spatial,[place]);assert.equal(frame.constellations[0].members[1]['aikit.techne-facet/v1'],undefined);
  const opened=await projectConstruction(transport,undefined,frame,current.relations,current);assert.equal(opened.state,'ready',JSON.stringify(opened));
  const document=opened.document,scene=document.scenes.find(row=>row.scene_ref===document.selection.scene_ref);
  const reading=await readWikiSceneTechne(transport,{expression_ref:document.expression_ref,revision:document.revision,scene_ref:scene.scene_ref});assert.equal(reading.temporal.length,2);assert.equal(reading.temporal[0].instant,temporal[0].instant);assert.equal(reading.temporal[1].kind,'valid');assert.deepEqual(reading.spatial,[place]);
  const compiled=await build({stdin:{contents:"export {readingInstruments,nativeInstrumentTitles} from './researchInstrumentsData.ts';export {kernelDocumentToJourney} from './kernelDocumentBridge.ts';",resolveDir:fileURLToPath(new URL('../expressions-app/field-studies-journeys/src/',import.meta.url)),loader:'ts'},tsconfig:fileURLToPath(new URL('../expressions-app/field-studies-journeys/tsconfig.json',import.meta.url)),bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
  const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64')),view=api.kernelDocumentToJourney(document),instruments=await api.readingInstruments(reading,api.nativeInstrumentTitles(view,view.startSceneId));
  const walk=await instruments.timeline.getTimelineWalk(scene.scene_ref,{startYear:2023,endYear:2025});assert.equal(walk.earthboundNodes.length,2);assert.ok(walk.earthboundNodes.some(row=>row.date===temporal[0].instant));
  const other=await knowledgeEntityRef(document.expression_ref,participation+'-undated'),emptyRef=document.expression_ref+':scene:other-participation';
  const edit=await kernelOp(transport,{op:'expression',request:{operation:'edit',expression_ref:document.expression_ref,expected_revision:document.revision,actor:'human:native-temporal-regression',changes:[{change:'scene_create',scene_ref:emptyRef,title:'Undated participation'},{change:'scene_compose',scene_ref:emptyRef,entity_refs:[other]}]}});assert.equal(edit.error,undefined);
  const absent=await readWikiSceneTechne(transport,{expression_ref:document.expression_ref,revision:edit.outcome.data.document.revision,scene_ref:emptyRef});assert.equal(absent.temporal,undefined,'same source in another participation borrows no dates');assert.equal(absent.spatial,undefined);
  const changed=await action([], {...request,expected_revision:frame.revision,operation_ref:'operation:wiki:change-frame',changes:[{change:'inquiry_set',title:'Changed frame basis',inquiry:{question:'An independently revised frame'}}]});assert.equal(changed.state,'invoked',JSON.stringify(changed));
  const fresh=await readRegister(transport);await assert.rejects(resolveSceneTemporalFacets(readWikiTemporal(fresh.file.content),document,scene),/changed source membership/,'stale native frame is refused even when subject identity is unchanged');
  assert.equal((await readNativeFile(transport,source.location)).revision,basis.revision);

 }finally{if(child){const stopped=child.exitCode===null?once(child,'exit'):null;try{process.kill(-child.pid,'SIGTERM');}catch{}if(stopped)await stopped;}await rm(scratch,{recursive:true,force:true});}
});
