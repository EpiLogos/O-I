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
import {getWikiProjectionState,subscribeWikiProjection,wikiReadingOf,applyWikiProjectionReceipt,refreshWikiProjectionReading,ensureWikiProjectionReading} from '../src/techne/wikiProjectionStore.ts';
import {readWikiSceneTechne} from '../src/techne/wikiReadingProvider.ts';
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
  // The shell may stand in Factory while the engine still presents Central.
  // Registers come from the actual native World disclosure, not a test catalogue.
  const world=await kernelOp(transport,{op:'world_read'});
  assert.equal(world.error,undefined,world.error);
  const projects=world.outcome?.snapshot?.navigator?.root?.work?.projects;
  assert.ok(Array.isArray(projects),'the native World discloses its project catalogue');
  publishWikiNativeRegisters(projects.map(row=>({name:row.name,path:row.path})));
  assert.ok(projects.some(row=>row.name==='Factory'),'this regression requires the actual Factory project seen in the failure');
  selectWikiNativeRegister('Factory');
  const nativeScene=ordered.scenes.find(row=>row.scene_ref===scene.scene_ref);
  const request={expression_ref:ordered.expression_ref,revision:ordered.revision,scene_ref:nativeScene.scene_ref};
  const calls=[],originalFetch=globalThis.fetch;
  let scoped;
  try {
    // Observe actual transport traffic; every response still comes from Rust.
    globalThis.fetch=async(input,init)=>{if(init?.body)calls.push(JSON.parse(init.body));return originalFetch(input,init);};
    scoped=await readWikiSceneTechne(transport,request);
  } finally {globalThis.fetch=originalFetch;}
  assert.deepEqual(calls.map(call=>call.op),['expression'],'cached Scene reading does not reread any register or knowledge provider');
  assert.equal(scoped.snapshot.revision,sourceReading.wikiBasis.revision);
  assert.equal(scoped.snapshot.basis_ref,'central:source:'+sourceReading.wikiBasis.path);
  assert.equal(scoped.subject.subject_ref,nativeScene.scene_ref);
  assert.deepEqual(scoped.expressions,[{expression_ref:ordered.expression_ref,revision:String(ordered.revision),scene_ref:nativeScene.scene_ref}]);
  const subjects=[...new Set(nativeScene.entity_refs.map(ref=>ordered.entities[ref]?.subject?.subject_ref).filter(Boolean))];
  assert.deepEqual(new Set(scoped.whole.member_refs),new Set(subjects),'only this native Scene supplies subject membership');
  for(const edge of scoped.whole.relations){assert.ok(subjects.includes(edge.from_ref));assert.ok(subjects.includes(edge.to_ref));}
  for(const facet of scoped.spatial??[])assert.ok(subjects.includes(facet.place_ref));
  assert.equal(scoped.temporal,undefined,'wiki revisions never become invented dates');
  assert.ok(scoped.disclosure.instruments.some(row=>row.instrument==='timeline'&&!row.available),'empty chronology is a valid reading with an explicit facet absence');
  assert.equal(wikiReadingOf(getWikiProjectionState().standings.central),sourceReading,'opening and focusing retained the actual source reading');
  await assert.rejects(readWikiSceneTechne(transport,{...request,revision:request.revision-1}),/revision changed/);
  await assert.rejects(readWikiSceneTechne(transport,{...request,scene_ref:'absent-native-scene'}),/Scene is absent/);

  const forked=await expression({operation:'fork',expression_ref:ordered.expression_ref,expected_revision:ordered.revision,new_expression_ref:'expression:native-scene-scope-fork',actor:'human:native-scope-regression'});
  assert.ok(forked.document,'the actual owner creates the fork');
  const forkScene=forked.document.scenes.find(row=>row.title===nativeScene.title);
  assert.ok(forkScene);
  const forkReading=await readWikiSceneTechne(transport,{expression_ref:forked.document.expression_ref,revision:forked.document.revision,scene_ref:forkScene.scene_ref});
  assert.equal(forkReading.snapshot.basis_ref,scoped.snapshot.basis_ref);
  assert.deepEqual(new Set(forkReading.whole.member_refs),new Set(scoped.whole.member_refs),'legitimate native forks retain exact source scope despite new occurrence IDs');
  const emptyScene='expression:native-scene-scope-fork:scene:local';
  const empty=await expression({operation:'edit',expression_ref:forked.document.expression_ref,expected_revision:forked.document.revision,actor:'human:native-scope-regression',changes:[{change:'scene_create',scene_ref:emptyScene,title:'Local empty Scene'}]});
  const emptyReading=await readWikiSceneTechne(transport,{expression_ref:empty.document.expression_ref,revision:empty.document.revision,scene_ref:emptyScene});
  assert.deepEqual(emptyReading.whole.member_refs,[]);assert.deepEqual(emptyReading.whole.relations,[]);
  assert.equal(emptyReading.temporal,undefined);assert.equal(emptyReading.spatial,undefined,'valid empty Scene has no borrowed locations');
  assert.equal(emptyReading.expressions[0].scene_ref,emptyScene,'absence of facets still returns the requested instrument reading');

  // A fresh JS host process has no projection cache, but the native document
  // already stands. Recover its exact register from native provenance once.
  const restartCode=`
    import assert from 'node:assert/strict';
    import {publishWikiNativeRegisters,selectWikiNativeRegister} from './src/techne/wikiNativeExpression.ts';
    import {readWikiSceneTechne} from './src/techne/wikiReadingProvider.ts';
    const input=JSON.parse(process.env.OI_SCENE_RESTORE_INPUT);
    publishWikiNativeRegisters(input.projects);selectWikiNativeRegister('Factory');
    const calls=[],fetchOwner=globalThis.fetch;
    globalThis.fetch=async(url,init)=>{if(init?.body)calls.push(JSON.parse(init.body));return fetchOwner(url,init);};
    const reading=await readWikiSceneTechne(input.transport,input.request);
    assert.equal(reading.snapshot.basis_ref,input.basis);
    const knowledge=calls.filter(call=>call.op==='knowledge');
    assert.equal(knowledge.length,1);assert.equal(knowledge[0].project,undefined);
    assert.ok(calls.filter(call=>call.op==='files_list').every(call=>!JSON.stringify(call).includes('Work/Factory')));
    console.log(JSON.stringify({reading,calls:calls.map(call=>call.op)}));
  `;
  const restored=spawn(process.execPath,['--experimental-strip-types','--import','./tests/ts-register.mjs','--input-type=module','-e',restartCode],{cwd:process.cwd(),env:{...process.env,OI_SCENE_RESTORE_INPUT:JSON.stringify({transport,projects:projects.map(row=>({name:row.name,path:row.path})),request,basis:scoped.snapshot.basis_ref})},stdio:['ignore','pipe','pipe']});
  let restoredOut='',restoredErr='';restored.stdout.on('data',chunk=>restoredOut+=chunk);restored.stderr.on('data',chunk=>restoredErr+=chunk);
  const [restoredExit]=await once(restored,'exit');assert.equal(restoredExit,0,restoredErr);
  const restoredResult=JSON.parse(restoredOut.trim());assert.deepEqual(restoredResult.reading,scoped,'fresh host reconstructs exactly the same Scene aperture from its proven source');

  // Exercise the receipt consumer without writing the user's source: this is
  // an explicit invalidation notification, not a claimed native file mutation.
  assert.deepEqual(applyWikiProjectionReceipt({event:'file_changed',path:sourceReading.wikiBasis.path,seq:1000000},transport),['central']);
  assert.equal(wikiReadingOf(getWikiProjectionState().standings.central),undefined,'stale source is unavailable immediately, before its real reread returns');
  await assert.rejects(ensureWikiProjectionReading(register,transport),/source reading changed|invalidated/);
  const refreshed=await refreshWikiProjectionReading(register,transport);
  assert.equal(refreshed.wikiBasis.revision,sourceReading.wikiBasis.revision,'read-only test left real source bytes unchanged');
  const afterRefresh=await readWikiSceneTechne(transport,request);
  assert.deepEqual(afterRefresh,scoped);
  assert.deepEqual((await expression({operation:'inspect',expression_ref:doc.expression_ref})).document,ordered,'instrument reads and source refresh never edit the native composition');

 }finally{if(child){const exited=child.exitCode===null?once(child,'exit'):null;try{process.kill(-child.pid,'SIGTERM');}catch{}if(exited)await exited;}await rm(home,{recursive:true,force:true});}
});
