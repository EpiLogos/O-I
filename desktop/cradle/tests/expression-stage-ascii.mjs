// Real native material, production projection and WebGL body. No replacement
// sampler, renderer or owner; a removed required body must fail acceptance.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('../',import.meta.url));
const file=process.argv[2]??resolve(root,'material/expressive-material/character/aletheia.expression.json');
const bytes=await readFile(file),native=JSON.parse(bytes),document=native.document??native;
const scene=document.scenes.find(s=>s.scene_ref===document.selection.scene_ref);
const body=scene.presentation.scene.entities.find(e=>e.source?.kind==='ascii');
assert.ok(body,'native source must contain the actual ASCII body');
const out=process.env.OI_ASCII_EVIDENCE_DIR; if(out)await mkdir(out,{recursive:true});
const server=await createServer({root,appType:'custom',logLevel:'error',server:{host:'127.0.0.1',port:0}});
server.middlewares.use('/ascii-regression',(_q,r)=>{r.setHeader('content-type','text/html');r.end('<html><body style="margin:0"><div id="stage" style="width:920px;height:520px;position:relative"></div></body></html>');});
await server.listen();
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:920,height:520}});
const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
const loadedModules=[],moduleReads=[];
page.on('response',response=>{
 const url=response.url();
 if(/expressions-engine|engineSurface|engineProjection/.test(url))moduleReads.push(response.body().then(bytes=>loadedModules.push({url,status:response.status(),sha256:createHash('sha256').update(bytes).digest('hex')})));
});
const evidence={schema:'oi.expression-ascii-renderer-regression/v1',source:{file,sha256:createHash('sha256').update(bytes).digest('hex'),native_revision:document.revision,body_ref:body.id},standing:'Production WebGL renderer, software GPU; retained native input; no tool effects; timed readings after 50 rendered startup frames',readings:[]};
const read=async label=>{
 const reading=await page.evaluate(id=>{
  const s=window.surface,e=s.adapter.engine,pool=e.entities.customCandidates.get(id+':'+id+'_base'),p=e.entities.partitions.find(p=>p.entityId===id);
  const pose=e.lastPoses.find(p=>p.entityId===id),screen=pose?e.projectWorldToScreen(pose.x,pose.y,pose.z??0):null;
  const canvas=s.capture(920,520),pixels=canvas.getContext('2d').getImageData(0,0,920,520).data;
  let bodyPixels=0,bodyInkPixels=0;const centre=screen??window.bodyCentre,background=Array.from(pixels.slice(0,4));
  if(centre)for(let y=Math.max(0,Math.floor(centre.y-45));y<Math.min(520,centre.y+45);y++)for(let x=Math.max(0,Math.floor(centre.x-45));x<Math.min(920,centre.x+45);x++){
   const i=(y*920+x)*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2];
   if(b>r*1.25&&g>r*1.1&&g>40&&pixels[i+3]>128)bodyPixels++;
  }
  // Native clean captures have transparent clear alpha. Actual ink includes
  // black as well as coloured particles; RGB alone cannot prove its absence.
  for(let i=3;i<pixels.length;i+=4)if(pixels[i]>0)bodyInkPixels++;
  if(screen)window.bodyCentre=screen;
  const sequence=e.getCompositionTelemetry().sequences.find(f=>f.entityId===id),entity=e.config.entities.find(v=>v.id===id);
  const link=index=>{
   const value=entity?.sequence?.links?.[index]??null,key=value?id+':'+value.id:null;
   const signature=value?s.adapter.sources.get(JSON.stringify([id,value.id])):null,candidates=key?e.entities.customCandidates.get(key):null;
   return {index,link:value,candidateSource:signature?{source:JSON.parse(signature),candidates:candidates?.length??0}:{kind:'shape',shape:value?.shape??entity?.shape}};
  };
  const state=e.inspectState(),hit=centre?s.hitTest('ascii-regression',centre.x,centre.y):null,nativeHit=centre?s.adapter.hitEntity(centre.x,centre.y):null;
  return {bodyPixels,bodyInkPixels,background,clearAlpha:e.renderer.getClearAlpha(),drawAdmission:{sourceType:e.config.sourceType,declaredEntities:Array.isArray(e.config.entities),nodePoolVisible:e.particleMaterial.uniforms.uNodePoolVisible.value,nativeDomain:s.adapter.nativeDomain,retainedTargetAdmitted:Boolean(s.adapter.retained?.external)},connections:e.nativeConnectionRuntime().inspect(),medium:{enabled:e.config.medium?.enabled??false,cymatic:e.config.cymatics?.enabled??false},hit,nativeHit,physical:{simTime:state.simTime,steps:state.steps,seeds:state.seeds,particleCount:state.particleCount},renderedBody:{enabled:entity?.enabled??null,partition:p?{start:p.start,end:p.end}:null,entityCount:e.entities.uniforms.count,transition:s.telemetry()?.transition??null,activeConfigEntityIds:e.config.entities.filter(v=>v.enabled!==false).map(v=>v.id)},frames:s.frameCount,nonfinite_candidates:pool?.filter(c=>Object.values(c).some(v=>typeof v==='number'&&!Number.isFinite(v))).length??0,nonfinite_targets:p?Array.from(e.entities.dataA.slice(p.start*4,p.end*4)).filter(v=>!Number.isFinite(v)).length:0,analysis:e.getSourceAnalysis(id),activeSequence:sequence?{...sequence,current:link(sequence.linkIndex),next:link(sequence.nextIndex)}:null,screen,errors:window.failures,sameCanvas:s.canvas===window.originalCanvas,sameContext:s.canvas.getContext('webgl2')===window.originalContext};
 },body.id);
 evidence.readings.push({label,...reading});if(out)await page.screenshot({path:resolve(out,label+'.png')});return reading;
};
// This predicate establishes required body presence and finiteness. Authored
// sequence readings and screenshots qualify its shape. A medium continuing
// after removal cannot satisfy the required native occurrence: current native
// admission and actual cyan pixels are both required; cached analysis cannot.
const accepted=r=>r.bodyPixels>=300&&r.nonfinite_candidates===0&&r.nonfinite_targets===0&&r.errors.length===0&&r.renderedBody.enabled===true&&r.renderedBody.partition!==null&&r.renderedBody.entityCount>0;
try{
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/ascii-regression`);
 await page.evaluate(async nativeDoc=>{
  const {EngineSurface}=await import('/src/stage/engineSurface.ts'),{expressionRenderConfig}=await import('/src/expression/engineProjection.ts');
  window.failures=[];window.surface=EngineSurface.forWindow(e=>window.failures.push(e));window.config=expressionRenderConfig(nativeDoc);window.sceneRef=nativeDoc.selection.scene_ref;
  window.surface.presentConfig('ascii-regression',window.config,window.sceneRef,[],'authored');window.surface.setContainer('ascii-regression',document.getElementById('stage'));
  window.bodyId=nativeDoc.scenes.find(s=>s.scene_ref===nativeDoc.selection.scene_ref).presentation.scene.entities.find(e=>e.source?.kind==='ascii').id;window.originalCanvas=window.surface.canvas;window.originalContext=window.originalCanvas.getContext('webgl2');
 },document);
 evidence.runtime=await page.evaluate(()=>{
  const gl=window.originalContext,debug=gl.getExtension('WEBGL_debug_renderer_info');
  return {userAgent:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},webgl:{version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(gl.RENDERER),vendor:gl.getParameter(gl.VENDOR),unmaskedRenderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null}};
 });
 evidence.runtime.browserVersion=browser.version();
 await page.waitForFunction(id=>window.surface.frameCount>=50&&window.surface.adapter.engine.getSourceAnalysis(id)?.candidates>0,body.id,{timeout:90000});
 await page.waitForTimeout(5000);const first=await read('native-5s');assert.ok(accepted(first),`Required ASCII body missing: ${JSON.stringify(first)}`);
 await page.waitForTimeout(10000);const later=await read('native-15s');assert.ok(accepted(later),`Required ASCII body disappeared: ${JSON.stringify(later)}`);
 await page.evaluate(id=>{const config=structuredClone(window.config);config.entities.find(e=>e.id===id).enabled=false;window.surface.presentConfig('ascii-regression',config,window.sceneRef,[],'authored');},body.id);
 await page.waitForTimeout(2000);const removed=await read('required-body-removed');assert.equal(accepted(removed),false,'Visual acceptance must fail when the required body is removed');
 assert.equal(removed.hit,null,'A disabled body must not remain selectable');
 assert.equal(removed.nativeHit,null,'The native picker must not select a disabled body');
 assert.equal(removed.physical.seeds,later.physical.seeds,'Body removal must not reseed the medium');
 await page.evaluate(()=>window.surface.presentConfig('ascii-regression',window.config,window.sceneRef,[],'authored'));
 await page.waitForTimeout(5000);const restored=await read('same-body-restored');assert.ok(accepted(restored),`Original ASCII did not return: ${JSON.stringify(restored)}`);
 assert.equal(restored.hit?.entity_ref,body.id,'Restored native body must select its actual occurrence');
 assert.equal(restored.nativeHit,body.id,'The native picker must recover the actual restored body');
 assert.equal(restored.physical.seeds,later.physical.seeds,'Body restoration must not reseed the medium');
 assert.ok(restored.physical.simTime>=removed.physical.simTime&&removed.physical.simTime>=later.physical.simTime,'The same native clock must continue');
 // Preserve genuine native medium ownership separately from required body
 // identity. The original character's continuous cymatic medium stays alive.
 await page.evaluate(()=>{const config=structuredClone(window.config);config.entities=[];config.sourceType='composition';config.medium.enabled=false;config.cymatics.enabled=true;window.surface.presentConfig('ascii-regression',config,window.sceneRef,[],'authored');});
 const mediumStart=await page.evaluate(()=>window.surface.frameCount);
 await page.waitForFunction(start=>window.surface.frameCount>=start+2,mediumStart);
 const medium=await read('empty-cymatic-medium');
 assert.equal(medium.renderedBody.entityCount,0);assert.equal(medium.medium.cymatic,true);
 assert.ok(medium.bodyInkPixels>0,'The independently driven native cymatic medium must still draw');
 assert.ok(medium.physical.steps>restored.physical.steps);assert.equal(medium.physical.seeds,restored.physical.seeds);
 // A no-medium composition cannot borrow the resident body's old particles.
 // This checks every alpha-bearing mark, including opaque black ink.
 await page.evaluate(()=>{const config=structuredClone(window.config);config.entities.find(e=>e.id===window.bodyId).enabled=false;config.medium.enabled=false;config.cymatics.enabled=false;window.surface.presentConfig('ascii-regression',config,window.sceneRef,[],'authored');window.surface.renderOnce('ascii-regression');});
 const quiescent=await read('required-body-removed-no-medium');
 assert.equal(quiescent.clearAlpha,0);assert.equal(quiescent.bodyInkPixels,0,'An unowned node pool must draw no contour in any colour');
 assert.equal(quiescent.hit,null);assert.equal(quiescent.nativeHit,null);assert.equal(quiescent.physical.seeds,restored.physical.seeds);
 assert.equal(quiescent.drawAdmission.sourceType,first.drawAdmission.sourceType,'The deprecated native import selector remains losslessly retained');
 assert.equal(quiescent.drawAdmission.declaredEntities,true);assert.equal(quiescent.drawAdmission.nodePoolVisible,0,'Explicit disabled native entities override the legacy source selector');
 assert.equal(quiescent.drawAdmission.nativeDomain,false);assert.equal(quiescent.drawAdmission.retainedTargetAdmitted,false);
 // Pin-only exact native relations own the existing tail, independently of
 // the formation pool. Exercise actual authoring, targets, GPU draw and pick.
 await page.evaluate(async()=>{
  const {blankScene,pin}=await import('/expressions-app/field-studies-journeys/src/model.ts');
  const {toNativeConfig}=await import('/expressions-app/field-studies-journeys/src/nativeBridge.ts');
  const scene=blankScene('Pin-only native relation');scene.id=window.sceneRef;scene.transition=0;scene.engine.resonanceEnabled=false;scene.engine.mediumEnabled=false;scene.field.background='#171a18';scene.field.palette=['#e5efe3','#e5efe3'];scene.field.params.count=window.config.particleCount;
  const a=pin({x:-.6,y:0,z:0}),b=pin({x:.6,y:0,z:0});a.id='expression:ascii-preservation:pin:a';b.id='expression:ascii-preservation:pin:b';a.force.strength=b.force.strength=0;scene.entities=[a,b];
  window.relation={binding_ref:'expression:ascii-preservation:relation:ab',from_entity_ref:a.id,to_entity_ref:b.id};window.pinConfig=toNativeConfig(scene);window.pinConfig.oiExpressionBindings={relations:[window.relation]};
  window.surface.presentConfig('ascii-regression',window.pinConfig,window.sceneRef,[],'authored');window.surface.renderOnce('ascii-regression');
 });
 const pins=await read('pin-only-native-relation');assert.equal(pins.renderedBody.entityCount,0);assert.equal(pins.medium.cymatic,false);assert.equal(pins.medium.enabled,false);
 assert.deepEqual(pins.connections.rendered,['expression:ascii-preservation:relation:ab']);assert.ok(pins.bodyInkPixels>0,'Admitted native relation-tail particles must remain visible');
 const picked=await page.evaluate(()=>{const e=window.surface.adapter.engine,a=e.projectWorldToScreen(-.6*400,0,0),middle=e.projectWorldToScreen(0,0,0);return {pin:window.surface.hitTest('ascii-regression',a.x,a.y),relation:window.surface.hitTest('ascii-regression',middle.x,middle.y)};});
 assert.equal(picked.pin?.entity_ref,'expression:ascii-preservation:pin:a');assert.equal(picked.relation?.binding_ref,'expression:ascii-preservation:relation:ab');
 await page.evaluate(()=>{const config=structuredClone(window.pinConfig);config.entities.find(e=>e.id===window.relation.to_entity_ref).enabled=false;window.surface.presentConfig('ascii-regression',config,window.sceneRef,[],'authored');window.surface.renderOnce('ascii-regression');});
 const endpointRemoved=await read('pin-endpoint-removed');assert.deepEqual(endpointRemoved.connections.rendered,[]);assert.deepEqual(endpointRemoved.connections.unavailable,['expression:ascii-preservation:relation:ab']);assert.equal(endpointRemoved.bodyInkPixels,0,'A disabled native endpoint cannot leave a rendered relation');
 assert.equal(endpointRemoved.physical.seeds,restored.physical.seeds);
 // Native count automation rebuilds the real material during advance, after
 // host projection. The unowned pool must stay absent on that very first draw.
 await page.evaluate(async()=>{
  const {blankScene}=await import('/expressions-app/field-studies-journeys/src/model.ts');const {toNativeConfig}=await import('/expressions-app/field-studies-journeys/src/nativeBridge.ts');
  const scene=blankScene('Empty count-automated native composition');scene.id=window.sceneRef;scene.transition=0;scene.engine.resonanceEnabled=false;scene.engine.mediumEnabled=false;scene.field.params.count=window.config.particleCount;
  window.automatedCount=window.config.particleCount+64;
  scene.automation=[{id:'count-rebuild',enabled:true,target:'field.count',type:'lfo',wave:'sine',min:window.automatedCount,max:window.automatedCount,rate:1,phase:0,blend:'replace',duration:1,delay:0,loop:'loop',firedAt:null}];
  window.surface.setPaused(true);window.countAdmissionBefore={frames:window.surface.frameCount,seeds:window.surface.adapter.engine.inspectState().seeds,simTime:window.surface.adapter.engine.inspectState().simTime};
  // Paused admission itself synchronously renders once. A second render
  // would conceal the first-frame rebuild defect before this capture.
  window.surface.presentConfig('ascii-regression',toNativeConfig(scene),window.sceneRef,[],'authored');
 });
 const rebuilt=await read('empty-count-automation-first-draw');
 assert.equal(rebuilt.physical.particleCount,await page.evaluate(()=>window.automatedCount),'The genuine count automation must have rebuilt its particle system');
 const countBefore=await page.evaluate(()=>window.countAdmissionBefore);
 assert.equal(rebuilt.frames,countBefore.frames+1,'Capture must inspect the first actual admission frame');
 assert.equal(rebuilt.physical.seeds,countBefore.seeds+1,'The actual supported count resize must take its single native reseed path');
 assert.equal(rebuilt.physical.simTime,countBefore.simTime,'Paused first-draw admission keeps the same native clock');
 assert.equal(rebuilt.clearAlpha,0);assert.equal(rebuilt.bodyInkPixels,0,'The unowned pool must stay absent during the material rebuild');
 assert.ok(rebuilt.physical.simTime>=endpointRemoved.physical.simTime,'Count resize preserves the same native clock');
 // Genuine old native input without an entity declaration uses the existing
 // migration at the normal stage entry, rather than a fabricated legacy body.
 await page.evaluate(()=>{
  const legacy=structuredClone(window.config);delete legacy.entities;legacy.sourceType='glyph';legacy.glyph='◉';legacy.cymatics.enabled=false;legacy.medium.enabled=false;
  window.surface.presentConfig('ascii-regression',legacy,window.sceneRef,[],'authored');
 });
 const legacy=await read('legacy-source-migrated-native-body');
 assert.ok(legacy.renderedBody.entityCount>0,'The actual native legacy migration must produce admitted formations');
 assert.equal(legacy.drawAdmission.nodePoolVisible,1);assert.ok(legacy.bodyInkPixels>0,'The migrated legacy body must actually draw');
 const legacyPick=await page.evaluate(()=>{const s=window.surface,e=s.adapter.engine,entity=e.config.entities.find(v=>v.kind==='formation'&&v.enabled),pose=e.lastPoses.find(p=>p.entityId===entity.id),point=e.projectWorldToScreen(pose.x,pose.y,pose.z??0);return{entity_ref:entity.id,nativeHit:s.adapter.hitEntity(point.x,point.y),sharedHit:s.hitTest('ascii-regression',point.x,point.y)};});
 assert.equal(legacyPick.nativeHit,legacyPick.entity_ref);assert.equal(legacyPick.sharedHit?.entity_ref,legacyPick.entity_ref);
 assert.ok(evidence.readings.every(r=>r.sameCanvas&&r.sameContext));assert.deepEqual(pageErrors,[]);
 evidence.acceptance={originalVisible:true,requiredRemovalFailed:true,restoredOnSameBody:true,emptyCymaticMediumPreserved:true,unownedNodePoolAbsent:true,pinOnlyRelationPreserved:true,disabledEndpointRelationAbsent:true,countRebuildAbsencePreserved:true,legacySourceMigratedAndRendered:true,claim:'Required body presence and finiteness; authored sequence and retained screenshots qualify contour identity. Browser component proof, not installed or two-human acceptance.'};
 await Promise.all(moduleReads);evidence.loadedModules=loadedModules;console.log(JSON.stringify(evidence));
}finally{await Promise.allSettled(moduleReads);evidence.loadedModules=loadedModules;if(out)await writeFile(resolve(out,'acceptance.json'),JSON.stringify({...evidence,pageErrors},null,2)+'\n');await page.evaluate(()=>window.surface?.dispose()).catch(()=>{});await browser.close();await server.close();}
