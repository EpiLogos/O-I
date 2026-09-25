/** Actual QL catalog → authored native Wiki roles → native Scene constraint,
 * engine anchors and native recovery store. No owner responses are mocked. */
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
import {readRegister,authoringForms,nativeFrame} from '../src/knowledge/construction.ts';
import {readSceneBlueprint} from '../src/knowledge/constructionBlueprint.ts';
import {publishWikiNativeRegisters} from '../src/techne/wikiNativeExpression.ts';
import {projectConstruction} from '../src/knowledge/constructionProjection.ts';


test('native sixfold blueprint constrains actual partial occurrences, moves the whole, recovers, forks and explicitly releases',{skip:process.env.OI_NATIVE_BLUEPRINT!=='1',timeout:120000},async()=>{
 for(const key of ['OI_KERNEL_BIN','OI_BIN','OI_AIKIT_BIN','OI_CENTRAL_CTRL_BIN'])assert.ok(process.env[key],key+' required');
 const evidenceDir=process.env.OI_NATIVE_BLUEPRINT_EVIDENCE_DIR;
 const scratch=evidenceDir??await mkdtemp(join(tmpdir(),'oi-blueprint-'));if(evidenceDir)await mkdir(scratch);
 const root=join(scratch,'Central'),home=join(scratch,'oi-home');let child,stderr='';const children=[];
 const env={...process.env,CENTRAL_ROOT:root,OI_CENTRAL_ROOT:root,OI_HOME:home,AIKIT_HOME:join(scratch,'aikit-home'),OI_CENTRAL_PROJECT_QUERY:''};
 try{
  await mkdir(root);await mkdir(home);
  assert.equal(JSON.parse(execFileSync(process.env.OI_CENTRAL_CTRL_BIN,['--root',root,'--json','action','run','central.init','{}'],{env,encoding:'utf8',timeout:30000})).ok,true);
  const startBridge=async()=>{
   const processChild=spawn(process.env.OI_KERNEL_BIN,['127.0.0.1:0'],{env,detached:true,stdio:['ignore','pipe','pipe']});children.push(processChild);processChild.stderr.on('data',chunk=>stderr+=chunk);
   const url=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error(stderr||'Native startup timed out')),30000);processChild.once('error',error=>{clearTimeout(timer);reject(error);});processChild.once('exit',code=>{clearTimeout(timer);reject(Error('Native exited '+code+stderr));});processChild.stdout.on('data',chunk=>{output+=chunk;const match=/listening on (http:\/\/[^ ]+)/.exec(output);if(match){clearTimeout(timer);resolve(match[1]);}});});
   return {processChild,url};
  };
  const initial=await startBridge();child=initial.processChild;const url=initial.url;
  const transport={kind:'bridge',url};
  const operation=async(op,request)=>{const result=await kernelOp(transport,{op,request});assert.equal(result.error,undefined,result.error);assert.equal(result.outcome?.result,op);return result.outcome.data;};
  let mutations=0,loseNext=false;
  const expression=async request=>{if(request.operation==='edit')mutations++;const value=await operation('expression',request);if(loseNext&&request.operation==='edit'){loseNext=false;throw Error('Test delivery loss after actual owner acknowledgement');}return value;};
  const before=await readRegister(transport),subject=before.spaces[0].ref,frameRef='wiki:frame:occurrence-proof';
  const parts=['participation:wiki:occurrence-a','participation:wiki:occurrence-b','participation:wiki:occurrence-c'];
  const form=(await authoringForms(transport)).find(f=>f.shape_ref==='ql:shape:1.0.0:constellation:sixfold');assert.ok(form);
  const roleIndices=[0,2,5];
  const request={schema:'aikit.constellation-action/v1',frame_ref:frameRef,expected_revision:0,actor_ref:'human:native-occurrence-regression',operation_ref:'operation:wiki:occurrence-proof',changes:[{change:'create',anchor_ref:'wiki:anchor:occurrence-proof',title:'Sixfold geometry proof',inquiry:{question:'Synthetic native proof: do three assigned roles retain exact sixfold geometry while the whole moves?'},space_refs:[subject],frame:nativeFrame(form)},...parts.map((part,i)=>({change:'member_add',member:{subject_ref:subject,participation:{participation_ref:part,role_ref:form.roles[roleIndices[i]].role_ref,sources:[],note:'Same source, distinct participation'}}})),{change:'relation_put',relation:{relation_ref:'wiki:edge:occurrence-proof',expected_revision:null,from_participation_ref:parts[0],to_participation_ref:parts[1],relation:'supports',direction:'directed',standing:'asserted',evidence:[]}}]};
  const apply=JSON.parse(execFileSync(process.env.OI_AIKIT_BIN,['--json','-C',root,'wiki-construct','apply','--file',join(root,before.file.location.path)],{env,input:JSON.stringify({basis_content:before.file.content,request}),encoding:'utf8',timeout:30000}));assert.ok(apply.ok,JSON.stringify(apply));
  const current=await readRegister(transport),frame=current.frames.find(row=>row.ref===frameRef),sourceBytes=await readFile(join(root,current.file.location.path));
  const opened=await projectConstruction(transport,undefined,frame,current.relations,current);assert.equal(opened.state,'ready',JSON.stringify(opened));
  const built=await build({stdin:{contents:"export {NativeWorking} from './nativeWorking.ts';export {toNativeConfig} from './nativeBridge.ts';export {kernelDocumentToJourney,nativeSceneMaterial} from './kernelDocumentBridge.ts';export {prepareBlueprintEdit} from './nativeBlueprint.ts';export {prepareCompositionEdit} from './kernelComposition.ts';export {blueprintPosition,applyBlueprintAnchors} from './blueprintGeometry.ts';export {blueprintTransformIntent} from './blueprintHUD.ts';",resolveDir:fileURLToPath(new URL('../expressions-app/field-studies-journeys/src/',import.meta.url)),loader:'ts'},bundle:true,platform:'node',format:'esm',target:'node22',write:false,logLevel:'silent'});
  const {NativeWorking,toNativeConfig,blueprintPosition,applyBlueprintAnchors,blueprintTransformIntent,kernelDocumentToJourney,nativeSceneMaterial,prepareCompositionEdit,prepareBlueprintEdit}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
  let retained,storeRevision=null;
  const checkpoint=async(id,value)=>{
   const out=await operation('expression_recovery',{operation:'write',scope:'techne',kind:'checkpoint',id,expected_revision:storeRevision,value});
   assert.equal(out.state,'written',JSON.stringify(out));storeRevision=out.record.revision;retained=out.record.value;
  };
  const make=()=>new NativeWorking({expression,checkpoint,file:async()=>assert.fail('No source or canonical file publication'),mint:()=>assert.fail('No new Expression identity')});
  let work=make(),view=await work.adopt(opened.document),scene=view.document.scenes.find(row=>row.scene_ref===view.document.selection.scene_ref),source=scene.entity_refs[0],reference=view.document.expression_ref;
  publishWikiNativeRegisters([]);
  const proposal=await readSceneBlueprint(transport,{expression_ref:reference,revision:view.document.revision,scene_ref:scene.scene_ref});
  assert.equal(proposal.binding.members.length,3,'vacant positions remain vacant');
  try{view=await work.editBlueprint({operation:'bind',...proposal});}catch(error){
   const expected=prepareBlueprintEdit(view,{operation:'bind',...proposal}).expected,actual=(await expression({operation:'inspect',expression_ref:reference})).document;
   const differences=[];const compare=(a,b,path)=>{if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const key of new Set([...Object.keys(a),...Object.keys(b)]))compare(a[key],b[key],path+'.'+key);}else if(a!==b)differences.push({path,expected:a,actual:b});};compare(expected,actual,'document');console.error(JSON.stringify({nativeBlueprintDifferences:differences.slice(0,40)}));throw error;
  }
  const binding=view.document.scenes.find(s=>s.scene_ref===scene.scene_ref).presentation.scene.composition.blueprint;
  assert.equal(Object.keys(view.document.entities).length,3);assert.equal(binding.members.length,3);
  const bound=structuredClone(view.document),member=binding.members[0];
  const refuse=async changes=>{const result=await kernelOp(transport,{op:'expression',request:{operation:'edit',expression_ref:reference,expected_revision:bound.revision,actor:'human:native-blueprint-regression',changes}});assert.ok(result.error,JSON.stringify(result));assert.deepEqual((await expression({operation:'inspect',expression_ref:reference})).document,bound);};
  await refuse([{change:'parameter_set',entity_ref:member.entity_ref,parameter:'x',value:35}]);
  await refuse([{change:'parameter_automate',entity_ref:member.entity_ref,parameter:'x',automation:{min:0,max:10,rate_hz:1,waveform:'sine'}}]);
  await refuse([{change:'scene_material_clear',scene_ref:scene.scene_ref}]);
  const bypass=structuredClone(bound.scenes.find(s=>s.scene_ref===scene.scene_ref).presentation);delete bypass.scene.composition.blueprint;
  await refuse([{change:'scene_material_set',scene_ref:scene.scene_ref,presentation:bypass}]);
  const skew=structuredClone(bound.scenes.find(s=>s.scene_ref===scene.scene_ref).presentation);skew.scene.entities[0].position.x+=.1;
  await refuse([{change:'scene_material_set',scene_ref:scene.scene_ref,presentation:skew}]);
  const transform={translation:[200,-100,45],rotation:[.2,.3,.4],scale:170};
  const activeSceneId=view.journey.scenes.find(s=>view.bindings[s.id].scene_ref===scene.scene_ref).id;
  const hudIntent=blueprintTransformIntent(view,activeSceneId,{translation:[.5,-.25,.1125],rotationDegrees:transform.rotation.map(r=>r*180/Math.PI),size:170/110});
  assert.deepEqual(hudIntent.transform.translation,transform.translation);assert.equal(hudIntent.transform.scale,transform.scale);
  for(let i=0;i<3;i++)assert.ok(Math.abs(hudIntent.transform.rotation[i]-transform.rotation[i])<1e-12);
  view=await work.editBlueprint(hudIntent);
  const transformed=view.document.scenes.find(s=>s.scene_ref===scene.scene_ref).presentation.scene.composition.blueprint;
  for(const m of transformed.members){const point=blueprintPosition(transformed,m.position);for(const [i,axis]of ['x','y','z'].entries())assert.ok(Math.abs(view.document.entities[m.entity_ref].parameters[axis].value-point[i])<1e-8);}
  const rendered=view.journey.scenes.find(s=>view.bindings[s.id].scene_ref===scene.scene_ref),config=toNativeConfig(rendered);
  for(const m of rendered.composition.blueprint.members){const target=config.entities.find(e=>e.id===m.entity_ref),point=blueprintPosition(rendered.composition.blueprint,m.position);assert.ok(target);for(const [i,axis]of ['x','y','z'].entries())assert.ok(Math.abs(target[axis]-point[i])<1e-8,'actual engine anchors follow whole transform');}
  const guardedMember=rendered.composition.blueprint.members[0],guardedIndex=config.entities.findIndex(e=>e.id===guardedMember.entity_ref);
  assert.throws(()=>applyBlueprintAnchors(rendered,{...config,automations:[{enabled:true,path:`entities.${guardedIndex}.sequence.links.0.x`}]}),/Release the blueprint/,'retained engine sequence automation cannot bypass the anchor');
  assert.deepEqual(view.document.relations,bound.relations);assert.deepEqual(await readFile(join(root,current.file.location.path)),sourceBytes);
  const mutationsBefore=mutations;loseNext=true;
  await assert.rejects(work.editBlueprint({operation:'transform',expression_ref:reference,revision:view.document.revision,scene_ref:scene.scene_ref,transform:{...transform,translation:[250,-80,45]}}),/delivery loss/);
  assert.equal(retained.pending.kind,'blueprint');const interrupted=structuredClone(retained);work=make();work.restore(interrupted,interrupted.view.journey);
  assert.match(await work.inspectPending(),/Recovered the exact native blueprint/);assert.equal(mutations,mutationsBefore+1);
  view=work.state.view;
  const forkRef='expression:blueprint-fork';const fork=await expression({operation:'fork',expression_ref:reference,expected_revision:view.document.revision,new_expression_ref:forkRef,actor:'human:native-blueprint-regression'});
  const forkBinding=fork.document.scenes.find(s=>s.presentation?.scene.composition.blueprint).presentation.scene.composition.blueprint;
  assert.ok(forkBinding.members.every(m=>m.entity_ref.startsWith(forkRef+':entity:')));assert.deepEqual(forkBinding.frame,binding.frame);
  const forkScene=fork.document.scenes.find(s=>s.presentation?.scene.composition.blueprint),localRefs=Array.from({length:11},(_,i)=>`${forkRef}:entity:local-${i}`);
  let mixed=(await expression({operation:'edit',expression_ref:forkRef,expected_revision:fork.document.revision,actor:'human:native-blueprint-regression',changes:localRefs.map((entity_ref,i)=>({change:'entity_add',scene_ref:forkScene.scene_ref,entity_ref,title:`Authored local item ${i+1}`}))})).document;
  const order=[forkBinding.members[0].entity_ref,...localRefs,...forkBinding.members.slice(1).map(m=>m.entity_ref)];
  const material=nativeSceneMaterial(mixed,{...mixed.scenes.find(s=>s.scene_ref===forkScene.scene_ref),presentation:null,entity_refs:order});material.composition.blueprint=structuredClone(forkBinding);
  mixed=(await expression({operation:'edit',expression_ref:forkRef,expected_revision:mixed.revision,actor:'human:native-blueprint-regression',changes:[{change:'scene_compose',scene_ref:forkScene.scene_ref,entity_refs:order},{change:'scene_material_set',scene_ref:forkScene.scene_ref,presentation:{schema:'oi.journey-scene/v1',scene:material,saved:null}}]})).document;
  for(const page of [0,1]){
   const paged=kernelDocumentToJourney(mixed,{pages:{[forkScene.scene_ref]:page}}),shown=paged.journey.scenes.find(s=>paged.bindings[s.id].scene_ref===forkScene.scene_ref);
   assert.equal(paged.bindings[shown.id].page_count,2);assert.equal(shown.composition.blueprint.members.length,3,'the whole binding survives page disclosure');
   const rendered=toNativeConfig(shown);assert.ok(shown.composition.blueprint.members.some(m=>!rendered.entities.some(e=>e.id===m.entity_ref)),'a page does not fabricate hidden members');
   for(const m of shown.composition.blueprint.members){const e=rendered.entities.find(e=>e.id===m.entity_ref);if(e){const point=blueprintPosition(shown.composition.blueprint,m.position);for(const [i,key]of ['x','y','z'].entries())assert.ok(Math.abs(e[key]-point[i])<1e-8);}}
   const edited=structuredClone(paged.journey);edited.scenes.find(s=>s.id===shown.id).view.zoom=1.15+page*.1;
   mixed=(await expression(prepareCompositionEdit(paged,edited))).document;
   assert.deepEqual(mixed.scenes.find(s=>s.scene_ref===forkScene.scene_ref).presentation.scene.composition.blueprint,forkBinding,'page edits preserve every bound native occurrence');assert.equal(Object.keys(mixed.entities).length,14);
  }
  const unchangedView=kernelDocumentToJourney(mixed),unchangedIntent={operation:'transform',expression_ref:forkRef,revision:mixed.revision,scene_ref:forkScene.scene_ref,transform:structuredClone(forkBinding.transform)};
  const unchangedPlan=prepareBlueprintEdit(unchangedView,unchangedIntent),unchangedActual=(await expression(unchangedPlan.request)).document;
  assert.deepEqual(unchangedActual,unchangedPlan.expected,'reapplying the displayed whole transform must agree with exact native readback');mixed=unchangedActual;
  const resolved=await kernelOp(transport,{op:'files_list',path:'Work',fresh:true});assert.equal(resolved.error,undefined,resolved.error);
  const saved=await expression({operation:'save_as',expression_ref:forkRef,expected_revision:mixed.revision,parent:resolved.outcome.directory.location,name:'sixfold-blueprint.expression.json',operation_ref:'operation:blueprint-file-proof',actor:'human:native-blueprint-regression',actor_kind:'human'});
  assert.equal(saved.state,'saved',JSON.stringify(saved));assert.ok(saved.file?.location,JSON.stringify(saved));
  const fresh=await startBridge(),freshTransport={kind:'bridge',url:fresh.url};
  const reopened=await kernelOp(freshTransport,{op:'expression',request:{operation:'open_file',location:saved.file.location,actor:'human:native-blueprint-regression'}});
  assert.equal(reopened.error,undefined,reopened.error);assert.deepEqual(reopened.outcome.data.document,mixed,'a fresh native process reopens the actual file with its full constraint');
  const held=structuredClone(view.document.entities);view=await work.editBlueprint({operation:'release',expression_ref:reference,revision:view.document.revision,scene_ref:scene.scene_ref});
  assert.equal(view.document.scenes.find(s=>s.scene_ref===scene.scene_ref).presentation.scene.composition.blueprint,undefined);
  assert.deepEqual(view.document.entities,held,'release preserves current authored arrangement');
  const changed=await expression({operation:'edit',expression_ref:reference,expected_revision:view.document.revision,actor:'human:native-blueprint-regression',changes:[{change:'parameter_set',entity_ref:member.entity_ref,parameter:'x',value:35}]});
  assert.equal(changed.document.entities[member.entity_ref].parameters.x.value,35);
  assert.deepEqual(await readFile(join(root,current.file.location.path)),sourceBytes,'presentation never mutates source roles or relations');
  if(evidenceDir){
   const liveFile=await expression({operation:'save_as',expression_ref:reference,expected_revision:changed.document.revision,parent:resolved.outcome.directory.location,name:'sixfold-live-roles.expression.json',operation_ref:'operation:blueprint-live-file-proof',actor:'human:native-blueprint-regression',actor_kind:'human'});assert.equal(liveFile.state,'saved',JSON.stringify(liveFile));
   await writeFile(join(scratch,'native-blueprint-proof.json'),JSON.stringify({schema:'oi.native-blueprint-proof/v1',synthetic:true,title:'Sixfold geometry proof',environment:Object.fromEntries(['CENTRAL_ROOT','OI_CENTRAL_ROOT','OI_HOME','AIKIT_HOME','OI_KERNEL_BIN','OI_BIN','OI_AIKIT_BIN','OI_CENTRAL_CTRL_BIN'].map(key=>[key,env[key]])),source:{frame_ref:frameRef,register:current.file.location},openForBind:{expression_ref:reference,file:liveFile.file.location,document:changed.document},openForWholeTransform:{expression_ref:forkRef,file:saved.file.location,document:mixed},geometry:{roles:[0,2,5],translation:[250,-80,45],rotation:[.2,.3,.4],scale:170},verified:['native bind','native HUD transform','strict member movement refusal','default recovery store','delivery-loss recovery','fork','two pages/14 occurrences','SaveAs/fresh-process OpenFile','no-op transform','explicit release','source bytes unchanged']},null,2)+'\n');
  }
 }finally{for(const child of children){const stopped=child.exitCode===null?once(child,'exit'):null;try{process.kill(-child.pid,'SIGTERM');}catch{}if(stopped)await stopped;}if(!evidenceDir)await rm(scratch,{recursive:true,force:true});}
});
