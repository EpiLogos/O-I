#!/usr/bin/env node
/** Controlled reference of an ACTUAL native Document through its production
 * document adapter, the exact app camera receiver and production renderer.
 * This is a reference/component path; it does not launch the ordinary app,
 * acquire a native field lease, write a document, or prove installed behavior.
 * Config: {native_document_file,output,identity_file?,
 *          authored_camera_pan_y?:number,require_original_camera_failure?:true}.
 * The optional camera variation is disclosed and changes only native view pan;
 * legacy input_file-only mode refuses because it bypassed the native receiver.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {chromium} from 'playwright';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
if(!process.argv[2])throw Error('Supply native_document_file and a task clearing output.');
const config=JSON.parse(await readFile(process.argv[2],'utf8'));
assert.ok(typeof config.native_document_file==='string'&&path.isAbsolute(config.native_document_file),'input_file-only references are unsupported: supply an actual native oi.expression/v1 Document.');
assert.ok(config.output.includes('/Control/agents/now/clearings/')&&config.output.includes('/T/'));
await mkdir(config.output,{recursive:true});
const originalBytes=await readFile(config.native_document_file),original=JSON.parse(originalBytes);
assert.equal(original.schema,'oi.expression/v1');assert.equal(original.scenes.length,3);
const candidate=structuredClone(original),cameraVariation=[];
if(config.authored_camera_pan_y!==undefined){
 assert.ok(Number.isFinite(config.authored_camera_pan_y));
 for(const scene of candidate.scenes){
  for(const material of [scene.presentation.scene,scene.presentation.saved].filter(Boolean)){
   cameraVariation.push({scene_ref:scene.scene_ref,carrier:material===scene.presentation.scene?'scene':'saved',before:material.view.panY,after:config.authored_camera_pan_y});
   material.view.panY=config.authored_camera_pan_y;
  }
 }
 const restored=structuredClone(candidate);
 for(let i=0;i<restored.scenes.length;i++){
  restored.scenes[i].presentation.scene.view.panY=original.scenes[i].presentation.scene.view.panY;
  if(restored.scenes[i].presentation.saved)restored.scenes[i].presentation.saved.view.panY=original.scenes[i].presentation.saved.view.panY;
 }
 assert.deepEqual(restored,original,'The authored reference variation must preserve the complete native Document except declared camera pan.');
}
await writeFile(path.join(config.output,'native-original-document.json'),originalBytes);
await writeFile(path.join(config.output,'authored-camera-candidate-document.json'),JSON.stringify(candidate)+'\n');
const app=path.join(root,'expressions-app/field-studies-journeys/src');
const paths={native_loader:path.join(app,'kernelDocumentBridge.ts'),camera:path.join(app,'camera.ts'),app_camera_receiver:path.join(app,'app.ts'),renderer:path.join(app,'production.ts'),native_parameters:path.join(app,'nativeParameters.ts'),encounter:path.join(app,'epiWorldEncounter.ts'),capture:path.join(app,'capture.ts'),material:path.join(app,'epiWorldMaterial.ts')};
const appBytes=await readFile(paths.app_camera_receiver),receiver=appBytes.toString().match(/^function applySceneView\(\)\{[^\n]+\}/m)?.[0];
assert.ok(receiver,'Exact ordinary applySceneView source is unavailable; do not replace it with reference math.');
const receiverSource=`import {defaultCamera,basis,stageCentre,stageScale} from ${JSON.stringify(paths.camera)};let camera,width,height,scene;const activeScene=()=>scene;${receiver}\nexport function receiveSceneCamera(nativeScene,w,h){scene=nativeScene;width=w;height=h;camera=defaultCamera();applySceneView();return {...camera};}`;
await writeFile(path.join(config.output,'actual-app-camera-receiver.ts'),receiverSource);
const entry=`export {kernelDocumentToJourney} from ${JSON.stringify(paths.native_loader)};export {ProductionAdapter} from ${JSON.stringify(paths.renderer)};export {WORLD_SCALE} from ${JSON.stringify(paths.native_parameters)};export {installEpiWorldEncounter} from ${JSON.stringify(paths.encounter)};export {paintText} from ${JSON.stringify(paths.capture)};export {receiveSceneCamera} from ${JSON.stringify(path.join(config.output,'actual-app-camera-receiver.ts'))};`;
const bundle=path.join(config.output,'actual-native-reference.js');
const compiled=await build({stdin:{contents:entry,resolveDir:root,sourcefile:'native-document-camera-reference.ts',loader:'ts'},outfile:bundle,bundle:true,platform:'browser',format:'iife',globalName:'Actual',logLevel:'warning',metafile:true});
const sourceReceipts=[];await mkdir(path.join(config.output,'source-copies'),{recursive:true});
for(const [role,p] of Object.entries(paths)){
 const bytes=await readFile(p),copy=path.join(config.output,'source-copies',role+path.extname(p));await writeFile(copy,bytes);sourceReceipts.push({role,path:p,sha256:hash(bytes),copy});
}
const profile=config.identity_file?JSON.parse(await readFile(config.identity_file,'utf8')).reading.profile:null;
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),views=[],negativeViews=[];
try{
 for(const [width,height] of [[1440,1000],[1280,820]]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.setContent('<!doctype html><style>html,body{margin:0;background:#10191c;color:#e1e5d8;font-family:system-ui;--panel:#172524;--ink:#e1e5d8}canvas{position:absolute;inset:0;width:100%;height:100%}button,summary{font:inherit;color:inherit;background:transparent;border:0;cursor:pointer}button{border-radius:3px}.stamp{position:fixed;bottom:12px;left:25px;font-size:10px;color:#a5b5b1;z-index:2}</style><canvas aria-label="Actual native Document authored camera reference"></canvas><div class="stamp">CONTROLLED AUTHORED CAMERA REFERENCE · REAL NATIVE DOCUMENT / LOADER / CAMERA / RENDERER · ORDINARY/INSTALLED PROOF SEPARATE</div>');
  await page.addStyleTag({path:path.join(config.output,'actual-native-reference.css')});await page.addScriptTag({path:bundle});
  const admission=await page.evaluate(({candidate,original,profile})=>{
   window.loaded=Actual.kernelDocumentToJourney(candidate);window.originalLoaded=Actual.kernelDocumentToJourney(original);window.nativeDoc=candidate;
   window.currentScene=window.loaded.journey.scenes[0];window.record=candidate.scenes.find(s=>s.presentation.scene.epiWorld)?.presentation.scene.epiWorld;
   if(!window.record)throw Error('Actual native Epi world carrier is absent.');
   const counts=window.loaded.journey.scenes.map(s=>s.entities.length);if(JSON.stringify(counts)!=='[32,9,7]')throw Error('The production native loader dropped required scene members.');
   const refuse=async()=>{throw Error('Controlled reference cannot execute native operations.');};
   window.encounter=Actual.installEpiWorldEncounter({active:()=>true,document:()=>window.nativeDoc,record:()=>window.record,scene:()=>window.currentScene.id,selected:()=>null,participant:()=>profile?{name:profile.name,occasion_utc:window.record.world.sky.request.epoch,observer_standing:'geocentric-location-independent',natal_place_label:profile.birth.place.label}:null,identity(){},ask:refuse,navigate:refuse,step:refuse,sound(){},quiet(){},save:refuse,reset:refuse});
   return{counts,expression_ref:candidate.expression_ref,document_revision:candidate.revision,source_basis:window.record.source_basis,register_counts:Object.fromEntries(Object.entries(window.record.register_members).map(([role,rows])=>[role,rows.length])),view_bodies:window.loaded.journey.scenes.map(s=>s.entities.map(e=>e.id)),native_bodies:candidate.scenes.map(s=>s.entity_refs),notes:window.loaded.notes};
  },{candidate,original,profile});
  assert.deepEqual(admission.register_counts,{degree:360,governor:24,decan:36,codon:64,skin:72,aperture:18});
  for(let index=0;index<3;index++){
   const result=await page.evaluate(async({index,width,height,negative})=>{
    const scene=(negative?window.originalLoaded:window.loaded).journey.scenes[index];window.currentScene=scene;window.encounter.refresh();
    const canvas=document.querySelector('canvas'),adapter=new Actual.ProductionAdapter(canvas);adapter.resize(width,height,1);
    const camera=Actual.receiveSceneCamera(scene,width,height);
    if(camera.yaw!==scene.view.yaw||camera.pitch!==scene.view.pitch)throw Error('Reference applied a second degree/radian conversion.');
    const frame={scene,scaffold:'off',authoringRevision:1,simTime:0,delta:0,params:scene.field.params,camera,pointer:{active:false,world:{x:0,y:0,z:0}},selectedIds:[]};
    let ready=false;for(let n=0;n<240;n++){adapter.render(frame);ready=Object.values(adapter.telemetry().sourceStatus).every(s=>s.includes('source active'));if(n>24&&ready)break;await new Promise(r=>setTimeout(r,16));}
    if(!ready)throw Error('Actual native source images did not decode.');
    const telemetry=adapter.telemetry(),resident=adapter.inspect(true);let maxGap=0;
    for(let p=0;p<resident.positions.length;p+=4)for(let axis=0;axis<3;axis++){const gap=Math.abs(resident.positions[p+axis]-resident.targets[p+axis]);if(!Number.isFinite(gap))throw Error('Non-finite resident body readback.');maxGap=Math.max(maxGap,gap);}
    if(maxGap>1e-6||resident.simTime!==0||resident.steps!==0)throw Error('Held actual GPU formations differ from their admitted native source targets.');
    const visibleBodies=resident.partitions.map(part=>{let visible=0;for(let i=part.start;i<part.end;i++){const off=i*4;if(resident.positions[off+3]<=0)continue;const p=adapter.projectNative({x:resident.positions[off]/Actual.WORLD_SCALE,y:resident.positions[off+1]/Actual.WORLD_SCALE,z:resident.positions[off+2]/Actual.WORLD_SCALE});if(p?.visible&&p.x>=0&&p.x<width&&p.y>=0&&p.y<height)visible++;}return{entity_ref:part.entityId,resident:part.end-part.start,visible};});
    const captured=adapter.capture(width,height),rgba=captured.getContext('2d').getImageData(0,0,width,height).data;let bright=0;for(let p=0;p<rgba.length;p+=4)if(rgba[p]>45||rgba[p+1]>55||rgba[p+2]>60)bright++;
    Actual.paintText(captured.getContext('2d'),scene,width,height);
    const png=captured.toDataURL('image/png'),overlay=document.createElement('img');overlay.style='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1';overlay.src=png;document.body.append(overlay);
    const bar=document.querySelector('.epi-world-entrance').getBoundingClientRect(),gl=canvas.getContext('webgl2'),debug=gl?.getExtension('WEBGL_debug_renderer_info');
    const gpu=gl?{version:gl.getParameter(gl.VERSION),renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)}:null;
    window.adapter=adapter;window.overlay=overlay;
    return{scene_ref:scene.id,camera,native_view:scene.view,bodies:telemetry.config.entities.length,particles:resident.positions.length/4,max_held_target_gap:maxGap,simTime:resident.simTime,steps:resident.steps,sourceStatus:telemetry.sourceStatus,visible_bodies:visibleBodies,visible_field_pixels:bright,nav:{top:bar.top,bottom:bar.bottom,left:bar.left,right:bar.right},gpu,png};
   },{index,width,height,negative:false});
   assert.equal(result.bodies,[32,9,7][index]);assert.ok(result.visible_field_pixels>1200,'Actual native-loaded scene has no visible field.');
   for(const body of result.visible_bodies)assert.ok(body.visible>0,'Required body is outside the viewport: '+body.entity_ref);
   assert.ok(result.nav.left>=0&&result.nav.right<=width&&result.nav.bottom<height);
   const role=['cosmic','personal','branches'][index],prefix=`${width}x${height}-${role}`;
   await writeFile(path.join(config.output,prefix+'-field.png'),Buffer.from(result.png.split(',')[1],'base64'));delete result.png;
   await page.screenshot({path:path.join(config.output,prefix+'-reference.png')});views.push({viewport:{width,height},role,admission,...result});
   await page.evaluate(()=>{window.adapter.dispose();window.overlay.remove();document.querySelector('canvas').replaceWith(document.createElement('canvas'));});
  }
  if(config.require_original_camera_failure){
   const result=await page.evaluate(async({width,height})=>{
    const scene=window.originalLoaded.journey.scenes[0],canvas=document.querySelector('canvas'),adapter=new Actual.ProductionAdapter(canvas);adapter.resize(width,height,1);
    const camera=Actual.receiveSceneCamera(scene,width,height),frame={scene,scaffold:'off',authoringRevision:1,simTime:0,delta:0,params:scene.field.params,camera,pointer:{active:false,world:{x:0,y:0,z:0}},selectedIds:[]};
    for(let n=0;n<180;n++){adapter.render(frame);if(n>24&&Object.values(adapter.telemetry().sourceStatus).every(s=>s.includes('source active')))break;await new Promise(r=>setTimeout(r,16));}
    const resident=adapter.inspect(true),parts=resident.partitions.map(part=>{let visible=0;for(let i=part.start;i<part.end;i++){const off=i*4;if(resident.positions[off+3]<=0)continue;const p=adapter.projectNative({x:resident.positions[off]/Actual.WORLD_SCALE,y:resident.positions[off+1]/Actual.WORLD_SCALE,z:resident.positions[off+2]/Actual.WORLD_SCALE});if(p?.visible&&p.x>=0&&p.x<width&&p.y>=0&&p.y<height)visible++;}return{entity_ref:part.entityId,visible};});
    const png=adapter.capture(width,height).toDataURL('image/png');adapter.dispose();return{camera,declared_bodies:scene.entities.length,partitions:parts,png};
   },{width,height});
   assert.equal(result.declared_bodies,32);assert.equal(result.partitions.length,32);assert.ok(result.partitions.every(p=>p.visible===0),'The reference must detect the original offscreen authored camera while retaining every semantic body.');
   await writeFile(path.join(config.output,`${width}x${height}-original-camera-failure-field.png`),Buffer.from(result.png.split(',')[1],'base64'));delete result.png;negativeViews.push({viewport:{width,height},...result});
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 const receipt={schema:'oi.epi-native-document-authored-reference/v1',standing:'Controlled reference of retained actual native Document through real kernelDocumentToJourney, exact source-extracted ordinary applySceneView and production renderer. Declared authored camera variation only; no native edit/ordinary launch/lease/live influence/audio/installed claim.',original_document:{path:config.native_document_file,sha256:hash(originalBytes),expression_ref:original.expression_ref,revision:original.revision},camera_variation:cameraVariation,source_receipts:sourceReceipts,camera_receiver:{source_sha256:hash(appBytes),exact_function_sha256:hash(receiver),copy:path.join(config.output,'actual-app-camera-receiver.ts')},bundle:{path:bundle,sha256:hash(await readFile(bundle)),input_paths:Object.keys(compiled.metafile.inputs)},environment:{browser:await browser.version(),headless:true,audio:'none',graphics:'Chromium ANGLE SwiftShader; actual WebGL2 readback'},views,original_camera_negatives:negativeViews};
 await writeFile(path.join(config.output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({passed:true,receipt:path.join(config.output,'receipt.json'),views:views.map(v=>({viewport:v.viewport,role:v.role,bodies:v.bodies,visible:v.visible_field_pixels,maxgap:v.max_held_target_gap,camera:v.camera})),original_camera_negatives:negativeViews}));
}finally{await browser.close();}
