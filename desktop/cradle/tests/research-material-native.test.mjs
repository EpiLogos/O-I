/** Real native Scene material commit, fork/removal and process-restart reopen.
 * The checkpoint port writes a real test-owned filesystem file, not the native
 * expression_recovery store (covered by expression-recovery-native.test.mjs).
 * All owner writes stay in a disposable OI_HOME; no substituted owner replies. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

test('research material uses the actual native Scene owner across commit, fork, removal and restart',{
 skip:process.env.OI_NATIVE_RESEARCH_MATERIAL!=='1'?'Set OI_NATIVE_RESEARCH_MATERIAL=1 and OI_KERNEL_BIN to the rebuilt native candidate':false,
 timeout:120000,
},async()=>{
 assert.ok(process.env.OI_KERNEL_BIN,'Explicit rebuilt native bridge is required');
 const compiled=await build({stdin:{contents:"export {NativeWorking} from './nativeWorking.ts';export {blankJourney,clone} from './model.ts';export {applyResearchMaterial} from './researchMaterial.ts';",resolveDir:fileURLToPath(new URL('../expressions-app/field-studies-journeys/src/',import.meta.url)),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
 const {NativeWorking,blankJourney,clone,applyResearchMaterial}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
 const home=await mkdtemp(join(tmpdir(),'oi-research-material-'));let child,url;
 const stop=async()=>{if(!child)return;const closed=child.exitCode===null?once(child,'exit'):null;if(closed){try{process.kill(-child.pid,'SIGTERM');}catch{}await closed;}child=undefined;};
 const start=async()=>{let stderr='';child=spawn(process.env.OI_KERNEL_BIN,['127.0.0.1:0'],{env:{...process.env,OI_HOME:home},detached:true,stdio:['ignore','pipe','pipe']});child.stderr.on('data',value=>stderr+=value);url=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('Native startup timed out: '+stderr)),30000);child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',code=>{clearTimeout(timer);reject(Error('Native exited '+code+': '+stderr));});child.stdout.on('data',value=>{output+=value;const found=/listening on (http:\/\/[^ ]+)/.exec(output);if(found){clearTimeout(timer);resolve(found[1]);}});});};
 const responseFor=async request=>{const response=await fetch(url+'/op',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op:'expression',request})});return response.json();};
 const native=async request=>{const returned=await responseFor(request);assert.equal(returned.ok,true,returned.error);assert.equal(returned.error,undefined,returned.error);return returned.outcome.data;};
 const checkpoint=join(home,'working.json'),ports={expression:native,checkpoint:async(_,record)=>writeFile(checkpoint,JSON.stringify(record)),file:async()=>assert.fail('No canonical file publication requested'),mint:()=> 'expression:research-material-acceptance'};
 try{
  await start();const working=new NativeWorking(ports),journey=blankJourney(),scene=journey.scenes[0];scene.entities=[];
  applyResearchMaterial(scene,{type:'create-card',kind:'note',title:'Native research note',position:{x:.5,y:.75}});const id=scene.entities[0].id;
  const content=JSON.stringify([{type:'heading',props:{level:2},content:[{type:'text',text:'Authored rich material',styles:{bold:true}}]},{type:'paragraph',content:[{type:'text',text:'Source citation expression:research-material-acceptance:entity:original stays verbatim',styles:{}}]}]);
  applyResearchMaterial(scene,{type:'card-content',id,content});
  applyResearchMaterial(scene,{type:'resize',id,width:600,height:400});
  applyResearchMaterial(scene,{type:'annotation-add',stroke:{id:'native-stroke',points:[{x:20,y:30},{x:50,y:80}],color:'#808080',width:3,opacity:1,createdAt:new Date().toISOString()}});
  applyResearchMaterial(scene,{type:'viewport',key:'canvas',value:{x:33,y:42,zoom:.8}});
  journey.savedScenes={[scene.id]:clone(scene)};
  await working.commit({journey,sceneId:scene.id,entityId:id});
  const basis=working.state.view,ref=basis.document.expression_ref,nativeId=basis.bindings[scene.id].occurrences.find(o=>o.view_entity_id===id).entity_ref;
  const owner=await native({operation:'inspect',expression_ref:ref});
  assert.equal(owner.document.scenes[0].presentation.scene.research.cards[nativeId].content,content);
  assert.equal(owner.document.scenes[0].presentation.scene.research.cards[id],undefined,'local id is not copied into the native owner');
  assert.deepEqual(owner.document.scenes[0].presentation.scene.research.views.canvas,{x:33,y:42,zoom:.8});
  const retained=JSON.parse(await readFile(checkpoint,'utf8'));
  await stop();await start();const resumed=new NativeWorking(ports);const restored=await resumed.reopenCheckpoint(retained,basis.journey);
  assert.equal(restored.journey.scenes[0].research.cards[id].content,content);
  assert.deepEqual(restored.document,owner.document,'same acknowledged native document reopens, no second research store');
  const forkRef='expression:research-material-fork';
  const forked=await native({operation:'fork',expression_ref:ref,expected_revision:owner.document.revision,new_expression_ref:forkRef,actor:'human:research-acceptance'});
  assert.equal(forked.state,'ready');
  const fork= forked.document,forkEntity=forkRef+nativeId.slice(ref.length),forkScene=fork.scenes[0];
  assert.ok(fork.entities[forkEntity],'native fork rekeys the actual occurrence');
  assert.ok(forkScene.entity_refs.includes(forkEntity));
  for(const material of [forkScene.presentation.scene,forkScene.presentation.saved]){
   assert.ok(material,'working and saved native Scene material both survive fork');
   assert.deepEqual(Object.keys(material.research.cards),[forkEntity]);
   assert.equal(material.research.cards[forkEntity].content,content,'only occurrence keys are readdressed, never authored prose/source citations');
   assert.equal(material.research.cards[nativeId],undefined);
   assert.equal(material.entities[0].id,forkEntity);
  }
  assert.deepEqual((await native({operation:'inspect',expression_ref:forkRef})).document,fork,'independent owner readback confirms the fork');
  const removed=await native({operation:'edit',expression_ref:forkRef,expected_revision:fork.revision,actor:'human:research-acceptance',changes:[{change:'entity_remove',entity_ref:forkEntity}]});
  assert.equal(removed.state,'ready');
  const afterRemoval=(await native({operation:'inspect',expression_ref:forkRef})).document;
  assert.equal(afterRemoval.entities[forkEntity],undefined);
  assert.ok(!afterRemoval.scenes[0].entity_refs.includes(forkEntity));
  for(const material of [afterRemoval.scenes[0].presentation.scene,afterRemoval.scenes[0].presentation.saved]){
   assert.deepEqual(material.research.cards,{},'removal prunes occurrence material from working and saved Scene');
   assert.deepEqual(material.entities,[]);
   assert.equal(material.research.strokes.length,1,'independent authored ink remains');
   assert.deepEqual(material.research.views.canvas,{x:33,y:42,zoom:.8});
  }
  assert.deepEqual((await native({operation:'inspect',expression_ref:ref})).document,owner.document,'fork/removal cannot mutate the original Expression');
  const invalid=clone(owner.document.scenes[0].presentation);invalid.scene.research.cards['absent:native:occurrence']={type:'note',content:'[]'};
  const rejected=await responseFor({operation:'edit',expression_ref:ref,expected_revision:owner.document.revision,actor:'human:research-acceptance',changes:[{change:'scene_material_set',scene_ref:owner.document.scenes[0].scene_ref,presentation:invalid}]});
  assert.ok(rejected.error||rejected.ok===false||rejected.outcome?.data?.state==='refused','the actual owner must explicitly refuse malformed occurrence material');
  assert.match(JSON.stringify(rejected),/research card.*disclosed occurrence/i,'refusal must come from the actual research occurrence admission check');
  assert.deepEqual((await native({operation:'inspect',expression_ref:ref})).document,owner.document,'invalid research identity cannot mutate the native owner');
 }finally{await stop();await rm(home,{recursive:true,force:true});}
});
