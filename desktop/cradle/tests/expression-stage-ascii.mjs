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
  let bodyPixels=0;const centre=screen??window.bodyCentre;
  if(centre)for(let y=Math.max(0,Math.floor(centre.y-45));y<Math.min(520,centre.y+45);y++)for(let x=Math.max(0,Math.floor(centre.x-45));x<Math.min(920,centre.x+45);x++){
   const i=(y*920+x)*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2];
   if(b>r*1.25&&g>r*1.1&&g>40&&pixels[i+3]>128)bodyPixels++;
  }
  if(screen)window.bodyCentre=screen;
  const sequence=e.getCompositionTelemetry().sequences.find(f=>f.entityId===id),entity=e.config.entities.find(v=>v.id===id);
  const link=index=>{
   const value=entity.sequence?.links?.[index]??null,key=value?id+':'+value.id:null;
   const signature=value?s.adapter.sources.get(JSON.stringify([id,value.id])):null,candidates=key?e.entities.customCandidates.get(key):null;
   return {index,link:value,candidateSource:signature?{source:JSON.parse(signature),candidates:candidates?.length??0}:{kind:'shape',shape:value?.shape??entity.shape}};
  };
  return {bodyPixels,renderedBody:{enabled:entity?.enabled??null,partition:p?{start:p.start,end:p.end}:null,entityCount:e.entities.uniforms.count,transition:s.telemetry()?.transition??null,activeConfigEntityIds:e.config.entities.filter(v=>v.enabled!==false).map(v=>v.id)},frames:s.frameCount,nonfinite_candidates:pool?.filter(c=>Object.values(c).some(v=>typeof v==='number'&&!Number.isFinite(v))).length??0,nonfinite_targets:p?Array.from(e.entities.dataA.slice(p.start*4,p.end*4)).filter(v=>!Number.isFinite(v)).length:0,analysis:e.getSourceAnalysis(id),activeSequence:sequence?{...sequence,current:link(sequence.linkIndex),next:link(sequence.nextIndex)}:null,screen,errors:window.failures,sameCanvas:s.canvas===window.originalCanvas,sameContext:s.canvas.getContext('webgl2')===window.originalContext};
 },body.id);
 evidence.readings.push({label,...reading});if(out)await page.screenshot({path:resolve(out,label+'.png')});return reading;
};
// This predicate establishes required body presence and finiteness. Authored
// sequence readings and screenshots qualify its shape; cached source analysis
// alone does not prove the currently developed target is the ASCII lamp.
const accepted=r=>r.bodyPixels>=300&&r.nonfinite_candidates===0&&r.nonfinite_targets===0&&r.errors.length===0;
try{
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/ascii-regression`);
 await page.evaluate(async nativeDoc=>{
  const {EngineSurface}=await import('/src/stage/engineSurface.ts'),{expressionRenderConfig}=await import('/src/expression/engineProjection.ts');
  window.failures=[];window.surface=EngineSurface.forWindow(e=>window.failures.push(e));window.config=expressionRenderConfig(nativeDoc);window.sceneRef=nativeDoc.selection.scene_ref;
  window.surface.presentConfig('ascii-regression',window.config,window.sceneRef,[],'authored');window.surface.setContainer('ascii-regression',document.getElementById('stage'));
  window.originalCanvas=window.surface.canvas;window.originalContext=window.originalCanvas.getContext('webgl2');
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
 await page.evaluate(()=>window.surface.presentConfig('ascii-regression',window.config,window.sceneRef,[],'authored'));
 await page.waitForTimeout(5000);const restored=await read('same-body-restored');assert.ok(accepted(restored),`Original ASCII did not return: ${JSON.stringify(restored)}`);
 assert.ok(evidence.readings.every(r=>r.sameCanvas&&r.sameContext));assert.deepEqual(pageErrors,[]);
 evidence.acceptance={originalVisible:true,requiredRemovalFailed:true,restoredOnSameBody:true,claim:'Required body presence and finiteness; authored sequence and retained screenshots qualify contour identity. Browser component proof, not installed or two-human acceptance.'};
 await Promise.all(moduleReads);evidence.loadedModules=loadedModules;console.log(JSON.stringify(evidence));
}finally{await Promise.allSettled(moduleReads);evidence.loadedModules=loadedModules;if(out)await writeFile(resolve(out,'acceptance.json'),JSON.stringify({...evidence,pageErrors},null,2)+'\n');await page.evaluate(()=>window.surface?.dispose()).catch(()=>{});await browser.close();await server.close();}
