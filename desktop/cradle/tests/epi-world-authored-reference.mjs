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
if(config.material_admission_lifecycle!==undefined)assert.equal(typeof config.material_admission_lifecycle,'boolean');
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
const paths={native_loader:path.join(app,'kernelDocumentBridge.ts'),camera:path.join(app,'camera.ts'),app_camera_receiver:path.join(app,'app.ts'),renderer:path.join(app,'production.ts'),native_parameters:path.join(app,'nativeParameters.ts'),encounter:path.join(app,'epiWorldEncounter.ts'),capture:path.join(app,'capture.ts'),material:path.join(app,'epiWorldMaterial.ts'),world_production:path.join(app,'epiWorldProduction.ts')};
const appBytes=await readFile(paths.app_camera_receiver),receiver=appBytes.toString().match(/^function applySceneView\(\)\{[^\n]+\}/m)?.[0];
assert.ok(receiver,'Exact ordinary applySceneView source is unavailable; do not replace it with reference math.');
const receiverSource=`import {defaultCamera,basis,stageCentre,stageScale,cameraForSceneView} from ${JSON.stringify(paths.camera)};let camera,width,height,scene;const activeScene=()=>scene;${receiver}\nexport function receiveSceneCamera(nativeScene,w,h){scene=nativeScene;width=w;height=h;camera=defaultCamera();applySceneView();return {...camera};}`;
await writeFile(path.join(config.output,'actual-app-camera-receiver.ts'),receiverSource);
const entry=`export {kernelDocumentToJourney} from ${JSON.stringify(paths.native_loader)};export {ProductionAdapter} from ${JSON.stringify(paths.renderer)};export {WORLD_SCALE} from ${JSON.stringify(paths.native_parameters)};export {installEpiWorldEncounter} from ${JSON.stringify(paths.encounter)};export {paintText} from ${JSON.stringify(paths.capture)};export {epiOpeningMaterial} from ${JSON.stringify(paths.world_production)};export {receiveSceneCamera} from ${JSON.stringify(path.join(config.output,'actual-app-camera-receiver.ts'))};`;
const bundle=path.join(config.output,'actual-native-reference.js');
const compiled=await build({stdin:{contents:entry,resolveDir:root,sourcefile:'native-document-camera-reference.ts',loader:'ts'},outfile:bundle,bundle:true,platform:'browser',format:'iife',globalName:'Actual',logLevel:'warning',metafile:true});
const sourceReceipts=[];await mkdir(path.join(config.output,'source-copies'),{recursive:true});
for(const [role,p] of Object.entries(paths)){
 const bytes=await readFile(p),copy=path.join(config.output,'source-copies',role+path.extname(p));await writeFile(copy,bytes);sourceReceipts.push({role,path:p,sha256:hash(bytes),copy});
}
const profile=config.identity_file?JSON.parse(await readFile(config.identity_file,'utf8')).reading.profile:null;

/** Opt-in real Image/production-GPU lifecycle counterproof. Rendered copies are
 * declared interventions, never native owner ACKs or edits of the source Doc. */
async function materialAdmissionLifecycle(page,width,height){
 return page.evaluate(async({width,height})=>{
  const source=window.loaded.journey.scenes[0],original=JSON.stringify(window.nativeDoc);
  const formations=source.entities.filter(e=>e.kind==='formation'&&e.enabled!==false);
  if(formations.length!==32)throw Error('Lifecycle requires all32 actual cosmic formations.');
  const create=()=>{const canvas=document.createElement('canvas');document.body.append(canvas);const adapter=new Actual.ProductionAdapter(canvas);adapter.resize(width,height,1);return{canvas,adapter};};
  const frame=(scene,revision,delta=0)=>({scene,authoringRevision:revision,simTime:0,delta,params:scene.field.params,camera:Actual.receiveSceneCamera(scene,width,height),pointer:{active:false,world:{x:0,y:0,z:0}},selectedIds:[],scaffold:'off'});
  const sourcesReady=a=>{const status=a.telemetry().sourceStatus,images=Object.entries(status).filter(([k])=>k!=='material-adoption');return images.length===6&&images.every(([,v])=>v.includes('source active'));};
  const waitSources=async(a,f)=>{for(let n=0;n<240;n++){a.render(f);if(sourcesReady(a))return n+1;await new Promise(r=>setTimeout(r,16));}throw Error('Real source decoding did not finish in the existing240-frame bound.');};
  const equal=(a,b)=>a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
  const summary=r=>{let gap=0;for(let n=0;n<r.positions.length;n+=4)for(let axis=0;axis<3;axis++){const d=Math.abs(r.positions[n+axis]-r.targets[n+axis]);if(!Number.isFinite(d))throw Error('Nonfinite actual resident/target readback.');gap=Math.max(gap,d);}return{seeds:r.seeds,steps:r.steps,simTime:r.simTime,particles:r.positions.length/4,max_target_gap:gap,partitions:r.partitions.map(p=>({entity_ref:p.entityId,start:p.start,end:p.end}))};};
  const evidence=async(a,r)=>({...summary(r),actual_float32_gpu_readback:true,array_lengths:{positions:r.positions.length,velocities:r.velocities.length,targets:r.targets.length},sourceStatus:a.telemetry().sourceStatus});
  const capture=a=>{try{const image=a.capture(width,height);return{accepted:true,width:image.width,height:image.height};}catch(e){return{accepted:false,error:String(e)};}};
  const owned=[],result={scope:'Actual retained native Document/loader/production renderer with declared component-only interventions. No native edit/ACK, ordinary app, lease, installation or audio proof.',interventions:[],states:{}};
  try{
   const live=create();owned.push(live);const a=live.adapter;
   // Real browser Image.onload is asynchronous. All three frames execute in
   // this same turn; no Image, callback, PointCloudField or source is replaced.
   const initial=structuredClone(source);a.render(frame(initial,1));
   const allocated=structuredClone(initial),changed=allocated.entities.find(e=>e.kind==='formation'&&e.enabled!==false);
   const share=changed.share;changed.share=share+1;
   result.interventions.push({kind:'component-allocation-only',entity_ref:changed.id,field:'share',before:share,after:changed.share});
   a.render(frame(allocated,2));
   const pending=Object.entries(a.telemetry().sourceStatus).filter(([k])=>k!=='material-adoption');
   result.pending_actual_sources={count:pending.length,all_decoding:pending.every(([,v])=>v==='Decoding image…')};
   const heldBefore=a.inspect(true);a.render(frame(allocated,2,1/60));const playing=a.inspect(true);
   result.states.play_interruption=await evidence(a,playing);result.states.play_interruption.capture=capture(a);
   result.states.play_interruption.one_real_step=playing.steps>heldBefore.steps&&playing.simTime>heldBefore.simTime;
   result.decode_frames=await waitSources(a,frame(allocated,2));const decoded=a.inspect(true);
   result.states.decoded_pause=await evidence(a,decoded);result.states.decoded_pause.capture=capture(a);
   result.states.decoded_pause.resident_unchanged_since_play=equal(decoded.positions,playing.positions)&&equal(decoded.velocities,playing.velocities)&&decoded.seeds===playing.seeds&&decoded.steps===playing.steps&&decoded.simTime===playing.simTime;
   const edited=structuredClone(allocated);edited.entities.find(e=>e.id===changed.id).position.x+=.01;
   result.interventions.push({kind:'component-live-edit-only',entity_ref:changed.id,field:'position.x',before:changed.position.x,after:changed.position.x+.01});
   a.render(frame(edited,3));const afterEdit=a.inspect(true);
   result.states.same_scene_edit=await evidence(a,afterEdit);result.states.same_scene_edit.capture=capture(a);
   result.states.same_scene_edit.no_reseed=afterEdit.seeds===playing.seeds&&afterEdit.steps===playing.steps&&afterEdit.simTime===playing.simTime;
   // Play intent invalidates pending initial-rest authority even when the
   // actual legal timeScale0 owner consumes no elapsed time or physics step.
   const stopped=create();owned.push(stopped);const z=stopped.adapter,zero=structuredClone(source);zero.field.params.timeScale=0;
   result.interventions.push({kind:'component-legal-zero-time-scale-only',field:'field.params.timeScale',before:source.field.params.timeScale,after:0});
   z.render(frame(zero,1));const zeroAllocated=structuredClone(zero),zeroBody=zeroAllocated.entities.find(e=>e.kind==='formation'&&e.enabled!==false);const zeroShare=zeroBody.share;zeroBody.share=zeroShare+1;
   result.interventions.push({kind:'component-zero-time-initial-allocation-only',entity_ref:zeroBody.id,field:'share',before:zeroShare,after:zeroBody.share});
   z.render(frame(zeroAllocated,2));const zeroPending=Object.entries(z.telemetry().sourceStatus).filter(([k])=>k!=='material-adoption');
   result.zero_time_pending_actual_sources={count:zeroPending.length,all_decoding:zeroPending.every(([,v])=>v==='Decoding image…')};
   const zeroBefore=z.inspect(true);z.render(frame(zeroAllocated,2,1/60));const zeroPlay=z.inspect(true);
   result.states.zero_time_play=await evidence(z,zeroPlay);result.states.zero_time_play.actual_time_scale=z.telemetry().config.fluid.timeScale;result.states.zero_time_play.capture=capture(z);
   result.states.zero_time_play.no_elapsed_or_seed=zeroPlay.simTime===zeroBefore.simTime&&zeroPlay.steps===zeroBefore.steps&&zeroPlay.seeds===zeroBefore.seeds;
   await waitSources(z,frame(zeroAllocated,2));const zeroPause=z.inspect(true);result.states.zero_time_pause=await evidence(z,zeroPause);result.states.zero_time_pause.capture=capture(z);
   result.states.zero_time_pause.resident_unchanged_since_play=equal(zeroPause.positions,zeroPlay.positions)&&equal(zeroPause.velocities,zeroPlay.velocities)&&zeroPause.simTime===zeroPlay.simTime&&zeroPause.steps===zeroPlay.steps&&zeroPause.seeds===zeroPlay.seeds;
   const zeroEdited=structuredClone(zeroAllocated);zeroEdited.entities.find(e=>e.id===zeroBody.id).share=zeroBody.share+1;
   result.interventions.push({kind:'component-zero-time-paused-same-Scene-allocation-only',entity_ref:zeroBody.id,field:'share',before:zeroBody.share,after:zeroBody.share+1});
   z.render(frame(zeroEdited,3));const zeroEdit=z.inspect(true);result.states.zero_time_same_scene_allocation=await evidence(z,zeroEdit);result.states.zero_time_same_scene_allocation.capture=capture(z);
   result.states.zero_time_same_scene_allocation.no_late_reseed=zeroEdit.seeds===zeroPlay.seeds&&zeroEdit.steps===zeroPlay.steps&&zeroEdit.simTime===zeroPlay.simTime;
   const held=structuredClone(edited);held.id=source.id+'-component-held-admission';result.interventions.push({kind:'component-scene-lifetime-only',before:edited.id,after:held.id});
   a.render(frame(held,4));await waitSources(a,frame(held,4));const admitted=a.inspect(true);
   result.states.different_held_scene=await evidence(a,admitted);result.states.different_held_scene.capture=capture(a);
   result.states.different_held_scene.one_seed_without_time=admitted.seeds===afterEdit.seeds+1&&admitted.steps===afterEdit.steps&&admitted.simTime===afterEdit.simTime;
   const fresh=create();owned.push(fresh);fresh.adapter.render(frame(source,1));await waitSources(fresh.adapter,frame(source,1));
   result.states.fresh_engine=await evidence(fresh.adapter,fresh.adapter.inspect(true));result.states.fresh_engine.capture=capture(fresh.adapter);
   const malformed=structuredClone(source);malformed.id=source.id+'-component-malformed-image';
   const carriers=malformed.entities.flatMap(e=>[e.source,...(e.layers??[]).map(l=>l.source),...(e.sequence?.steps??[]).flatMap(k=>[k.source,...(k.layers??[]).map(l=>l.source)])]).filter(s=>s?.kind==='image'&&s.image?.dataUrl);
   if(!carriers.length)throw Error('Actual native image source absent.');
   const dataUrl=carriers[0].image.dataUrl,truncated=dataUrl.split(',')[0]+','+dataUrl.split(',')[1].slice(0,12);let mirrors=0;
   const corrupt=value=>{if(!value||typeof value!=='object')return;if(value.kind==='image'&&value.image?.dataUrl===dataUrl){value.image.dataUrl=truncated;mirrors++;}for(const child of Object.values(value))corrupt(child);};corrupt(malformed);
   result.interventions.push({kind:'component-malformed-one-original-PNG-and-exact-mirrors-only',mirrors,source_url_bytes_before:dataUrl.length,source_url_bytes_after:truncated.length});
   const bad=create();owned.push(bad);bad.adapter.render(frame(malformed,1));
   let failed=false;for(let n=0;n<240;n++){bad.adapter.render(frame(malformed,1));if(Object.values(bad.adapter.telemetry().sourceStatus).some(v=>v==='The embedded image could not be decoded.')){failed=true;break;}await new Promise(r=>setTimeout(r,16));}
   result.states.malformed_image={failed,sourceStatus:bad.adapter.telemetry().sourceStatus,capture:capture(bad.adapter)};
   malformed.id+='-next-held';bad.adapter.render(frame(malformed,2));
   result.states.malformed_next_scene={sourceStatus:bad.adapter.telemetry().sourceStatus,capture:capture(bad.adapter)};
   result.original_native_document_unchanged=JSON.stringify(window.nativeDoc)===original;
   const gl=live.canvas.getContext('webgl2'),extension=gl?.getExtension('WEBGL_debug_renderer_info');
   result.gpu=gl?{version:gl.getParameter(gl.VERSION),renderer:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)}:null;
   return result;
  }finally{for(const {adapter,canvas} of owned){adapter.dispose();canvas.remove();}}
 },{width,height});
}

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
   window.encounter=Actual.installEpiWorldEncounter({active:()=>true,document:()=>window.nativeDoc,record:()=>window.record,scene:()=>window.currentScene.id,selected:()=>null,participant:()=>profile?{name:profile.name,occasion_utc:window.record.world.sky.request.epoch,observer_standing:'geocentric-location-independent',natal_place_label:profile.birth.place.label}:null,identity(){},ask:refuse,navigate:refuse,step:refuse,sound(){},quiet(){},save:refuse,reset:refuse,damping:()=>window.record.current_material_policy?.material.damping_per_second??Actual.epiOpeningMaterial(window.record).damping_per_second,setDamping:refuse});
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
  if(config.material_admission_lifecycle&&width===1440){
   const lifecycle={schema:'oi.epi-material-admission-lifecycle-browser/v1',passed:false,original_document:{path:config.native_document_file,sha256:hash(originalBytes),expression_ref:original.expression_ref,revision:original.revision},renderer_source_sha256:sourceReceipts.find(r=>r.role==='renderer').sha256,bundle_sha256:hash(await readFile(bundle)),environment:{browser:await browser.version(),headless:true,audio:'none',ordinary_app:false,native_lease:false}};
   try{
    lifecycle.actual=await materialAdmissionLifecycle(page,width,height);const r=lifecycle.actual,s=r.states;
    const interrupted='Initial allocation admission was interrupted; reopen the saved world at rest.';
    assert.equal(r.pending_actual_sources.count,6);assert.equal(r.pending_actual_sources.all_decoding,true,'The original actual sources must still be decoding before same-turn Play');
    assert.equal(s.play_interruption.sourceStatus['material-adoption'],interrupted);assert.equal(s.play_interruption.one_real_step,true);assert.equal(s.play_interruption.capture.accepted,false);
    assert.equal(s.decoded_pause.sourceStatus['material-adoption'],interrupted);assert.equal(s.decoded_pause.resident_unchanged_since_play,true,'Source completion while paused must not reseed or advance the actual resident field');assert.equal(s.decoded_pause.capture.accepted,false);
    assert.equal(s.same_scene_edit.sourceStatus['material-adoption'],interrupted);assert.equal(s.same_scene_edit.no_reseed,true);assert.equal(s.same_scene_edit.capture.accepted,false);
    assert.equal(r.zero_time_pending_actual_sources.count,6);assert.equal(r.zero_time_pending_actual_sources.all_decoding,true,'Real zero-time source decode must be pending before Play');
    assert.equal(s.zero_time_play.actual_time_scale,0);assert.equal(s.zero_time_play.no_elapsed_or_seed,true);assert.equal(s.zero_time_play.simTime,0);assert.equal(s.zero_time_play.steps,0);
    for(const label of ['zero_time_play','zero_time_pause','zero_time_same_scene_allocation']){assert.equal(s[label].sourceStatus['material-adoption'],interrupted,label+': Play intent keeps initial admission interrupted even without physical elapsed time');assert.equal(s[label].capture.accepted,false);}
    assert.equal(s.zero_time_pause.resident_unchanged_since_play,true);assert.equal(s.zero_time_same_scene_allocation.no_late_reseed,true,'A same-Scene paused allocation edit cannot recover canceled admission authority');
    for(const label of ['different_held_scene','fresh_engine']){const state=s[label];assert.equal(Object.hasOwn(state.sourceStatus,'material-adoption'),false,label+': stale interruption retired only at a fresh admission');assert.equal(state.capture.accepted,true);assert.equal(state.partitions.length,32);assert.ok(state.partitions.every(p=>p.end>p.start));assert.ok(state.max_target_gap<=1e-6,label+': all32 actual resident bodies receive decoded targets');assert.equal(JSON.stringify(state.partitions.map(p=>p.entity_ref)),JSON.stringify(admission.view_bodies[0]),label+': exact required subject membership');}
    assert.equal(s.different_held_scene.one_seed_without_time,true);assert.equal(s.fresh_engine.steps,0);assert.equal(s.fresh_engine.simTime,0);
    assert.equal(s.malformed_image.failed,true);assert.equal(s.malformed_image.capture.accepted,false);assert.equal(s.malformed_next_scene.capture.accepted,false);assert.ok(Object.values(s.malformed_next_scene.sourceStatus).includes('The embedded image could not be decoded.'),'Scene lifetime cannot clear an actual source error');
    assert.equal(r.original_native_document_unchanged,true);assert.ok(r.gpu?.version?.includes('WebGL 2'));
    lifecycle.passed=true;
   }catch(error){lifecycle.failure=String(error);throw error;}finally{await writeFile(path.join(config.output,'material-admission-lifecycle-receipt.json'),JSON.stringify(lifecycle,null,2)+'\n');}
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 const receipt={schema:'oi.epi-native-document-authored-reference/v1',standing:'Controlled reference of retained actual native Document through real kernelDocumentToJourney, exact source-extracted ordinary applySceneView and production renderer. Declared authored camera variation only; no native edit/ordinary launch/lease/live influence/audio/installed claim.',original_document:{path:config.native_document_file,sha256:hash(originalBytes),expression_ref:original.expression_ref,revision:original.revision},camera_variation:cameraVariation,source_receipts:sourceReceipts,camera_receiver:{source_sha256:hash(appBytes),exact_function_sha256:hash(receiver),copy:path.join(config.output,'actual-app-camera-receiver.ts')},bundle:{path:bundle,sha256:hash(await readFile(bundle)),input_paths:Object.keys(compiled.metafile.inputs)},environment:{browser:await browser.version(),headless:true,audio:'none',graphics:'Chromium ANGLE SwiftShader; actual WebGL2 readback'},views,original_camera_negatives:negativeViews};
 await writeFile(path.join(config.output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({passed:true,receipt:path.join(config.output,'receipt.json'),views:views.map(v=>({viewport:v.viewport,role:v.role,bodies:v.bodies,visible:v.visible_field_pixels,maxgap:v.max_held_target_gap,camera:v.camera})),original_camera_negatives:negativeViews}));
}finally{await browser.close();}
