/** Actual saved native Expression -> existing production Stage -> GPU pixels.
 * This is a source-renderer/resource replay, not an installed or two-human
 * experience claim. It never replays agent/tool effects or fabricates a Run. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {build} from '../node_modules/esbuild/lib/main.js';
import {chromium} from 'playwright';
import {filterExpressionComposition} from '../../../shared-field/expression-projection.mjs';
import {retireNativeBrowserOwners} from './native-expression-central.mjs';
const cradle=fileURLToPath(new URL('../',import.meta.url));
const source=process.env.OI_SHARED_NATIVE_DOCUMENT;
assert.ok(source?.startsWith('/'),'OI_SHARED_NATIVE_DOCUMENT must name an actual saved native Expression');
const out=resolve(process.env.OI_SHARED_RESOURCE_OUT??'tests/artifacts/shared-expression-resources');
await mkdir(out,{recursive:true});
const original=await readFile(source);
const document=JSON.parse(original);
assert.equal(document.schema,'oi.expression/v1');
const composition=filterExpressionComposition(document,{include_scene_material:true}).composition;
const scene=composition.scenes.find(s=>s.scene_ref===composition.selection.scene_ref);
assert.ok(scene.presentation,'The actual producer must have supplied native Scene material');
assert.ok(scene.presentation.scene.entities.some(e=>e.sequence.enabled),'The actual saved scene must contain running formation sequences');
const report={standing:'Source renderer on actual saved native material; controlled user identities, no replayed effects; installed acceptance separate',source:{path:source,sha256:createHash('sha256').update(original).digest('hex'),expression_ref:document.expression_ref,revision:document.revision},samples:[],visual:{},pass:false};
const requiredReturn=process.env.OI_SHARED_REQUIRED_RETURN_TEXT==='1';
if(requiredReturn){
 const actPath=process.env.OI_SHARED_NATIVE_ACT,receiptPath=process.env.OI_SHARED_NATIVE_OWNER_RECEIPT;
 assert.ok(actPath?.startsWith('/')&&receiptPath?.startsWith('/'),'Required returned text must name its actual native Act and owner receipt');
 const actBytes=await readFile(actPath),act=JSON.parse(actBytes),receipt=JSON.parse(await readFile(receiptPath,'utf8'));
 assert.equal(receipt.pass,true,'The actual native owner must have accepted this document');
 assert.equal(receipt.native_document.sha256,report.source.sha256);
 assert.equal(receipt.native_act.sha256,createHash('sha256').update(actBytes).digest('hex'));
 const text=scene.presentation.scene.text.find(layer=>layer.role==='resultText');
 assert.ok(text,'The required returned native text slot is absent');
 assert.equal(text.bodySize,18,'The required native text must retain its authored18px size');
 const source=act.sequence.find(passage=>passage.kind==='text'&&passage.role==='resultText'&&passage.native_ref);
 assert.ok(source,'The actual Act must retain the complete returned source');
 const pages=act.sequence.filter(passage=>passage.kind==='edition'&&passage.native_ref===source.native_ref);
 assert.ok(pages.length>1,'The complete reply must produce native retained pages');
 assert.equal(pages.map(page=>page.text).join(''),source.text);
 assert.equal(pages[0].target_ref,document.expression_ref);
 assert.equal(pages[0].scene_ref,document.selection.scene_ref);
 assert.equal(text.body,pages[0].text,'The renderer must receive the actual first retained native page');
 report.native_return={act_ref:act.act_ref,revision:act.revision,complete_source_bytes:Buffer.byteLength(source.text),pages:pages.length,selected_page:pages[0].scene_ref,scene_refs:pages.map(page=>page.scene_ref)};
}
const bundle=join(out,'renderer.js');
// Use the shipped native camera companion, exactly as the production Stage.
const camera=resolve(cradle,'../../packages/oi-design-system/expressions-engine/shell/camera.mjs');
report.camera={source:camera,sha256:createHash('sha256').update(await readFile(camera)).digest('hex')};
await build({stdin:{contents:`import {EngineSurface} from './src/stage/engineSurface.ts';import {expressionRenderConfig} from './src/expression/engineProjection.ts';import {cameraForSceneView,project} from '../../packages/oi-design-system/expressions-engine/shell/camera.mjs';import {paintText,textLayout} from '../../packages/oi-design-system/expressions-engine/shell/capture.mjs';window.nativeModules={EngineSurface,expressionRenderConfig,cameraForSceneView,project,paintText,textLayout};`,resolveDir:cradle},bundle:true,format:'iife',platform:'browser',target:'es2022',nodePaths:[join(cradle,'node_modules')],outfile:bundle});
const html='<!doctype html><style>body{margin:0;background:white}#stage{position:relative;width:100vw;height:100vh}#inscriptions{position:absolute;inset:0;z-index:1;pointer-events:none}</style><div id="stage"><canvas id="inscriptions"></canvas></div><script src="/renderer.js"></script>';
const server=createServer(async(req,res)=>{try{res.setHeader('content-type',req.url==='/renderer.js'?'text/javascript':req.url==='/composition.json'?'application/json':'text/html');res.end(req.url==='/renderer.js'?await readFile(bundle):req.url==='/composition.json'?JSON.stringify(composition):html);}catch(error){res.statusCode=500;res.end(String(error));}});
let browserOwner,browser,page,cdp,browserCdp;
const errors=[];
const startup=async operation=>{let timer;try{return await Promise.race([operation(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Owned renderer startup exceeded15s')),15000);})]);}finally{clearTimeout(timer);}};
try{
 await startup(()=>new Promise((accept,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',accept);}));
 browserOwner=await chromium.launchServer({timeout:15000,headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl']});
 browser=await chromium.connect(browserOwner.wsEndpoint(),{timeout:15000});
 page=await startup(()=>browser.newPage({viewport:{width:1440,height:900}}));
 cdp=await startup(()=>page.context().newCDPSession(page));
 browserCdp=await startup(()=>browser.newBrowserCDPSession());
 await startup(()=>cdp.send('Performance.enable'));
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.evaluate(async()=>{
  const d=window.documentReading=await (await fetch('/composition.json')).json();
  window.errors=[];window.surface=window.nativeModules.EngineSurface.forElement(document.querySelector('#stage'),e=>window.errors.push(e));
  const cfg=window.config=window.nativeModules.expressionRenderConfig(d);
  window.surface.presentConfig(d.expression_ref,cfg,d.selection.scene_ref);
  const scene=d.scenes.find(s=>s.scene_ref===d.selection.scene_ref).presentation.scene;
  const text=document.querySelector('#inscriptions');text.width=innerWidth;text.height=innerHeight;window.nativeModules.paintText(text.getContext('2d'),scene,innerWidth,innerHeight);
 });
 await page.waitForFunction(()=>window.surface.telemetry()?.simTime>3,null,{timeout:90000});
 report.webgl=await page.evaluate(()=>{const gl=window.surface.canvas.getContext('webgl2');const ext=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER),vendor:gl.getParameter(ext?ext.UNMASKED_VENDOR_WEBGL:gl.VENDOR)};});
 const sample=async label=>{
  const metrics=(await cdp.send('Performance.getMetrics')).metrics;
  const processes=(await browserCdp.send('SystemInfo.getProcessInfo')).processInfo;
  const pids=processes.map(p=>p.id);let rss=0;
  const ps=execFileSync('ps',['-p',pids.join(','),'-o','rss='],{encoding:'utf8'});
  for(const row of ps.trim().split(/\s+/))rss+=(Number(row)||0)*1024;
  const state=await page.evaluate(()=>{const adapter=window.surface['adapter'],s=adapter.inspect(false);return {simTime:s.simTime,steps:s.steps,seeds:s.seeds,bakes:s.bakes,particleCount:s.particleCount,resources:adapter.inspectResources(),partitions:s.partitions.map(p=>({id:p.entityId??p.id,count:p.count??p.end-p.start}))};});
  const row={label,wall_clock:new Date().toISOString(),heap_used:metrics.find(m=>m.name==='JSHeapUsedSize')?.value,rss_bytes:rss,...state};report.samples.push(row);console.log(JSON.stringify({sample:row}));
  assert.ok(rss<2*1024**3,'Stop before this owned browser group exceeds 2 GiB resident memory');
  return row;
 };
 const visual=()=>page.evaluate(()=>{
  const d=window.documentReading,scene=d.scenes.find(s=>s.scene_ref===d.selection.scene_ref).presentation.scene,camera=window.nativeModules.cameraForSceneView(scene.view,innerWidth,innerHeight);
  const canvas=window.surface.capture(innerWidth,innerHeight),pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
  const engine=window.surface['adapter'].engine,poses=engine.lastPoses??[];
  return scene.entities.filter(e=>e.enabled!==false).map(entity=>{
   const pose=poses.find(p=>p.entityId===entity.id||p.id===entity.id);
   // Evaluated poses already use the native engine's world-unit scale.
   // The normalized Scene camera is only the absent-body inspection basis.
   const point=pose?engine.projectWorldToScreen(pose.x,pose.y,pose.z):window.nativeModules.project(entity.position,camera,innerWidth,innerHeight);let ink=0;
   for(let y=Math.max(0,Math.round(point.y)-45);y<Math.min(canvas.height,Math.round(point.y)+45);y++)for(let x=Math.max(0,Math.round(point.x)-45);x<Math.min(canvas.width,Math.round(point.x)+45);x++){const i=(y*canvas.width+x)*4;if(pixels[i+3]>80&&Math.min(pixels[i],pixels[i+1],pixels[i+2])<175)ink++;}
   return {id:entity.id,name:entity.name,x:point.x,y:point.y,evaluated_pose:!!pose,ink_pixels:ink};
  });
 });
 const resultText=scene.presentation.scene.text.find(t=>t.role==='resultText');
 if(requiredReturn||resultText?.bodySize===18){
  const measurePage=sceneRef=>page.evaluate(async sceneRef=>{
   const d=window.documentReading;
   const reading={...d,selection:{...d.selection,scene_ref:sceneRef}};
   const scene=d.scenes.find(s=>s.scene_ref===sceneRef)?.presentation?.scene;
   if(!scene)throw new Error('Retained native page material is absent: '+sceneRef);
   const cfg=window.nativeModules.expressionRenderConfig(reading);
   window.surface.presentConfig(d.expression_ref,cfg,sceneRef);
   let timer;
   try{await Promise.race([window.surface.whenReady(d.expression_ref),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Retained native page did not render within12s')),12000);})]);}finally{clearTimeout(timer);}
   const result=scene.text.find(t=>t.role==='resultText');
   if(!result)throw new Error('Retained native page has no returned text');
   const layout=window.nativeModules.textLayout(result,innerWidth,innerHeight);
   const canvas=document.querySelector('#inscriptions'),ctx=canvas.getContext('2d'),original=ctx.fillText.bind(ctx),draws=[],inscriptions=[];
   ctx.clearRect(0,0,canvas.width,canvas.height);
   ctx.fillText=(value,x,y)=>{
    const m=ctx.measureText(value);
    if(ctx.font==='18px Arial')draws.push({text:value,x,y,width:m.width,font:ctx.font});
    if(value.trim())inscriptions.push({text:value,font:ctx.font,left:x-m.actualBoundingBoxLeft,right:x+m.actualBoundingBoxRight,top:y-m.actualBoundingBoxAscent,bottom:y+m.actualBoundingBoxDescent});
    original(value,x,y);
   };
   try{window.nativeModules.paintText(ctx,scene,innerWidth,innerHeight);}finally{ctx.fillText=original;}
   const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
   const lines=draws.map(draw=>{let ink=0;for(let y=Math.max(0,Math.floor(draw.y));y<Math.min(canvas.height,Math.ceil(draw.y+24));y++)for(let x=Math.max(0,Math.floor(draw.x));x<Math.min(canvas.width,Math.ceil(draw.x+draw.width));x++){const at=(y*canvas.width+x)*4;if(pixels[at+3]>30&&Math.min(pixels[at],pixels[at+1],pixels[at+2])<175)ink++;}return {...draw,ink_pixels:ink,inside_column:draw.width<=layout.width+1,inside_viewport:draw.x>=0&&draw.y>=0&&draw.x+draw.width<=innerWidth&&draw.y+18<=innerHeight};});
   // Read the actual production connection layer's evaluated paths, including
   // their current physical poses and camera. Authored coordinates alone do
   // not establish where the visible connections have developed.
   const adapter=window.surface['adapter'],connection=adapter.connectionLayer;
   connection?.update();
   const paths=(connection?.paths??[]).map(path=>({binding_ref:path.binding.binding_ref,points:path.points.map(p=>adapter.engine.projectWorldToScreen(p.x,p.y,p.z))}));
   const intersects=(a,b,line)=>{
    if(!a.visible||!b.visible)return false;
    let low=0,high=1;
    for(const [start,delta,min,max] of [[a.x,b.x-a.x,line.x-4,line.x+line.width+4],[a.y,b.y-a.y,line.y-4,line.y+24]]){
     if(!delta){if(start<min||start>max)return false;continue;}
     const t1=(min-start)/delta,t2=(max-start)/delta;
     low=Math.max(low,Math.min(t1,t2));high=Math.min(high,Math.max(t1,t2));
     if(low>high)return false;
    }
    return true;
   };
   const overlaps=[];
   for(const path of paths)for(const line of lines)if(line.text.trim()&&path.points.some((p,i)=>i&&intersects(path.points[i-1],p,line)))overlaps.push({binding_ref:path.binding_ref,text:line.text});
   const inscription_overlaps=[];
   for(let i=0;i<inscriptions.length;i++)for(let j=i+1;j<inscriptions.length;j++){
    const a=inscriptions[i],b=inscriptions[j];
    if(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)inscription_overlaps.push({first:a.text,second:b.text});
   }
   return {scene_ref:sceneRef,body:result.body,lines,inscriptions,inscription_overlaps,expected_connections:cfg.oiExpressionBindings.relations.map(r=>r.binding_ref).sort(),rendered_connections:paths.map(p=>p.binding_ref).sort(),overlaps};
  },sceneRef);
  report.visual.retained_pages=[];
  const refs=report.native_return?.scene_refs??[composition.selection.scene_ref];
  for(const [index,ref] of refs.entries()){
   const reading=await measurePage(ref);
   report.visual.retained_pages.push(reading);
   await page.screenshot({path:join(out,`native-scene-page-${index+1}.png`)});
   assert.ok(reading.lines.some(line=>line.text.trim()),'Each actual retained native page must have visible18px text');
   assert.equal(reading.lines.map(line=>line.text).join(''),reading.body.replace(/\n/g,''),'Actual native wrapping must paint every literal retained source character, including whitespace');
   assert.ok(reading.lines.filter(line=>line.text.trim()).every(line=>line.inside_column&&line.inside_viewport&&line.ink_pixels>3),`Native page must fit its readable column and viewport: ${JSON.stringify(reading)}`);
   assert.ok(reading.inscriptions.every(line=>[line.left,line.right,line.top,line.bottom].every(Number.isFinite)&&line.left>=0&&line.right<=1440&&line.top>=0&&line.bottom<=900),'Every actual native inscription must remain inside the viewport');
   assert.deepEqual(reading.inscription_overlaps,[],`Actual native inscriptions must not overlap: ${JSON.stringify(reading.inscription_overlaps)}`);
   assert.ok(reading.expected_connections.length,'This actual shared undertaking must retain its co-present native relations');
   assert.deepEqual(reading.rendered_connections,reading.expected_connections,'The actual co-present native connections must remain rendered');
   assert.deepEqual(reading.overlaps,[],`Native connections must not cross the returned text: ${ref}`);
  }
  const first=await measurePage(composition.selection.scene_ref);
  report.visual.returned_text=first.lines;
 }
 const start=await sample('stable native material');
 report.visual.before=await visual();
 assert.ok(report.visual.before.every(body=>body.evaluated_pose&&body.ink_pixels>20),`Every required shared body must paint at its actual developed pose: ${JSON.stringify(report.visual.before)}`);
 await page.screenshot({path:join(out,'native-scene-before.png')});
 for(let i=0;i<6;i++){
  await page.waitForTimeout(10000);
  await sample(`stable live sequences ${i+1}`);
 }
 await cdp.send('HeapProfiler.collectGarbage');
 const stable=await sample('stable material after collection');
 assert.equal(stable.seeds,start.seeds,'The live sequence must not reseed its particle medium');
 assert.ok(stable.heap_used<start.heap_used+64*1024**2,'One minute of fixed native sequences must not retain another64MiB of JS material');
 // Counterprobe the old heartbeat behavior with fresh copies of exactly the
 // same owner material, preserving the source document and native identity.
 for(let i=0;i<30;i++){
  await page.evaluate(()=>{const d=window.documentReading;window.surface.presentConfig(d.expression_ref,structuredClone(window.config),d.selection.scene_ref);});
  await page.waitForTimeout(200);
 }
 await cdp.send('HeapProfiler.collectGarbage');
 const churn=await sample('30 identical material replacements');
 assert.ok(churn.heap_used<stable.heap_used+64*1024**2,'Repeated identical native material must have bounded retained JS state');
 for(const row of report.samples){
  assert.equal(row.resources.geometries,start.resources.geometries,'Live sequences reuse native geometry');
  assert.equal(row.resources.textures,start.resources.textures,'Live sequences and repeated material reuse native textures');
  assert.ok(row.resources.programs<=start.resources.programs+1,'Capture may warm one shader; live material cannot retain more programs');
  const cache=row.resources.candidateCache;
  assert.ok(cache.entries<=cache.maxEntries&&cache.estimatedBytes<=cache.maxEstimatedBytes,'Native formation candidates remain within the owner budget');
 }
 const required=scene.presentation.scene.entities.find(e=>e.name.startsWith('Ann'));
 assert.ok(required,'This actual native episode must contain Ann');
 const ann=report.visual.before.find(e=>e.id===required.id);
 assert.ok(ann.ink_pixels>20,`Ann's actual GPU body must be visible: ${JSON.stringify(ann)}`);
 // Deliberately drop the required RENDERED body while retaining the owner
 // composition, text and controls. Acceptance still expects the real Ann.
 await page.evaluate(id=>{const d=window.documentReading,c=structuredClone(window.config);c.entities=c.entities.filter(e=>e.id!==id);window.surface.presentConfig(d.expression_ref,c,d.selection.scene_ref);},required.id);
 await page.waitForTimeout(4000);
 report.visual.required_body_removed=await visual();
 await page.screenshot({path:join(out,'native-scene-required-body-removed.png')});
 const missing=report.visual.required_body_removed.find(e=>e.id===required.id);
 report.visual.acceptance_failed=missing.ink_pixels<=20;
 assert.equal(report.visual.acceptance_failed,true,`Visual acceptance must fail with Ann's body removed; labels cannot substitute: ${JSON.stringify(missing)}`);
 await page.evaluate(()=>{window.surface.release(window.documentReading.expression_ref);window.surface.dispose();});
 await cdp.send('HeapProfiler.collectGarbage');
 assert.equal(await page.locator('canvas[data-oi-stage="engine"]').count(),0,'Disposal removes the actual renderer canvas');
 assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.errors),[]);report.pass=true;
 console.log(JSON.stringify({pass:true,source:report.source,webgl:report.webgl,samples:report.samples,visual:report.visual},null,2));
}catch(error){report.failure=String(error);throw error;}
finally{report.owner_cleanup=await retireNativeBrowserOwners({browser,browserOwner,server});for(const[owner,result]of Object.entries(report.owner_cleanup))if(!result.ok){report.pass=false;report.cleanup_failure=`${owner}: ${result.error}`;}await writeFile(join(out,'resource-replay.json'),JSON.stringify(report,null,2));if(report.cleanup_failure)throw new Error(report.cleanup_failure);}
