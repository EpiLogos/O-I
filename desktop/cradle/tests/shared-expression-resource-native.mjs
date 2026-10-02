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
const bundle=join(out,'renderer.js');
// Read the current native camera source pending its bounded vendored refresh.
// This remains the instrument's actual implementation, never a replacement.
const camera=join(cradle,'expressions-app/field-studies-journeys/src/camera.ts');
report.camera={source:camera,sha256:createHash('sha256').update(await readFile(camera)).digest('hex')};
await build({stdin:{contents:`import {EngineSurface} from './src/stage/engineSurface.ts';import {expressionRenderConfig} from './src/expression/engineProjection.ts';import {cameraForSceneView,project} from './expressions-app/field-studies-journeys/src/camera.ts';import {paintText} from './expressions-app/field-studies-journeys/src/capture.ts';window.nativeModules={EngineSurface,expressionRenderConfig,cameraForSceneView,project,paintText};`,resolveDir:cradle},bundle:true,format:'iife',platform:'browser',target:'es2022',outfile:bundle,plugins:[{name:'current-native-camera-source',setup(b){b.onResolve({filter:/camera\.mjs$/},args=>args.path.includes('expressions-engine')||args.importer.includes('expressions-engine')?{path:camera}:undefined);}}]});
const html='<!doctype html><style>body{margin:0;background:white}#stage{position:relative;width:100vw;height:100vh}#inscriptions{position:absolute;inset:0;z-index:1;pointer-events:none}</style><div id="stage"><canvas id="inscriptions"></canvas></div><script src="/renderer.js"></script>';
const server=createServer(async(req,res)=>{try{res.setHeader('content-type',req.url==='/renderer.js'?'text/javascript':req.url==='/composition.json'?'application/json':'text/html');res.end(req.url==='/renderer.js'?await readFile(bundle):req.url==='/composition.json'?JSON.stringify(composition):html);}catch(error){res.statusCode=500;res.end(String(error));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--enable-webgl']});
const page=await browser.newPage({viewport:{width:1440,height:900}}),cdp=await page.context().newCDPSession(page),browserCdp=await browser.newBrowserCDPSession();
await cdp.send('Performance.enable');
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
try{
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
  return scene.entities.filter(e=>e.enabled!==false).map(entity=>{
   const point=window.nativeModules.project(entity.position,camera,innerWidth,innerHeight);let ink=0;
   for(let y=Math.max(0,Math.round(point.y)-45);y<Math.min(canvas.height,Math.round(point.y)+45);y++)for(let x=Math.max(0,Math.round(point.x)-45);x<Math.min(canvas.width,Math.round(point.x)+45);x++){const i=(y*canvas.width+x)*4;if(pixels[i+3]>80&&Math.min(pixels[i],pixels[i+1],pixels[i+2])<175)ink++;}
   return {id:entity.id,name:entity.name,x:point.x,y:point.y,ink_pixels:ink};
  });
 });
 const start=await sample('stable native material');
 report.visual.before=await visual();
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
 assert.deepEqual(errors,[]);report.pass=true;
 console.log(JSON.stringify({pass:true,source:report.source,webgl:report.webgl,samples:report.samples,visual:report.visual},null,2));
}catch(error){report.failure=String(error);throw error;}
finally{await writeFile(join(out,'resource-replay.json'),JSON.stringify(report,null,2));await browser.close();await new Promise(r=>server.close(r));}
