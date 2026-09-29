/** One scene determinant, traced end to end through the real owners:
 * QL `ql scene binding` → O:I kernel compose (walk-bridge) → ql-field-host +
 * C++ worker → iframe relay → InstrumentSession → NativeProjection → WebGL GPU
 * simulation → canvas pixels and scheduled PCM.
 *
 * Three fresh pages open the same deterministic owner (sky none, QL's default
 * event) with Math.random seeded and the field held from admission (reduced
 * motion), so resident particles move only under explicit fixed probe steps:
 *   control A, control B (determinism baseline), varied V (one `m1-advance`).
 * The positive claim needs every layer: producer influence changes, transferred
 * targets change, GPU positions after N steps differ from control beyond the
 * A/B baseline and lie nearer the new targets, pixels differ, and scheduled PCM
 * carries the sky's top voice at its held pitch. K2_DISCONNECT_TARGETS=1 cuts GPU target delivery
 * (test-only projection flag) before the determinant: that run must FAIL.
 * Only Central disclosure is controlled; no fake field, PCM, M1, M2 or M3. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,mkdtemp,rm,chmod} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir,platform,cpus} from 'node:os';
import {createHash} from 'node:crypto';
import {build} from '../expressions-app/node_modules/esbuild/lib/main.js';
import {chromium} from 'playwright';
const paths={bridge:process.env.NATIVE_EXPRESSION_BRIDGE,ql:process.env.OI_QL_BIN,host:process.env.OI_QL_FIELD_HOST_BIN,worker:process.env.OI_QL_FIELD_WORKER_BIN};
for(const [name,path] of Object.entries(paths))assert.ok(path&&path.startsWith('/'),`Explicit absolute ${name} path required; no PATH or fixture fallback`);
const disconnect=process.env.K2_DISCONNECT_TARGETS==='1';
const STEPS=Number(process.env.K2_PROBE_STEPS??120),DT=1/60;
const out=resolve(process.env.NATIVE_EXPRESSION_OUT??'walk/artifacts/native-expression-scene');await mkdir(out,{recursive:true});
const temp=await mkdtemp(join(tmpdir(),'native-expression-scene-'));
const report={schema:'oi.native-expression-scene-trace/v1',mode:disconnect?'negative: GPU target delivery disconnected before the determinant':'positive',
 standing:'real QL compose, K8 C++ owner, O:I kernel relay and WebGL; controlled Central disclosure; sky none (QL default event); SwiftShader unless hardware requested; not installed-app, speaker or listening evidence',
 checks:[],failures:[],sources:{},machine:{platform:platform(),logical_cpus:cpus().length},probe:{steps:STEPS,dt:DT},pass:false};
for(const [name,path] of Object.entries(paths))report.sources[name]={path,sha256:createHash('sha256').update(await readFile(path)).digest('hex')};
const central=join(temp,'central.py');
await writeFile(central,`#!/usr/bin/env python3
import json,sys
raise SystemExit(json.dumps({'ok':False,'error':'controlled Central: compose reads no Central file'}))
`);await chmod(central,0o700);
// sky none: the kernel never runs ql-sky; the override law names both or neither.
const bridge=spawn(paths.bridge,['127.0.0.1:0'],{env:{...process.env,OI_BIN:central,OI_CENTRAL_ROOT:temp,OI_CENTRAL_PROJECT_QUERY:'',OI_QL_BIN:paths.ql,OI_QL_SKY_BIN:'/usr/bin/false',OI_QL_FIELD_HOST_BIN:paths.host,OI_QL_FIELD_WORKER_BIN:paths.worker},stdio:['ignore','pipe','pipe']});
let bridgeLog='',bridgeErr='';bridge.stdout.on('data',x=>bridgeLog+=x);bridge.stderr.on('data',x=>bridgeErr+=x);
const endpoint=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('kernel bridge startup timed out')),15000);bridge.once('error',reject);bridge.once('exit',code=>{clearTimeout(timer);reject(new Error(`bridge exited ${code}: ${bridgeErr}`));});bridge.stdout.on('data',()=>{const match=bridgeLog.match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timer);resolve(match[0]);}});});
let opens=0,closes=0;const wire=[];const timings=[];
await build({stdin:{contents:`import {relayNativeChannel} from './src/expressions/nativeChannel.ts'; window.disposeRelay=relayNativeChannel(document.querySelector('iframe'),{kind:'bridge',url:location.origin});`,resolveDir:resolve('.')},bundle:true,platform:'browser',format:'esm',outfile:join(temp,'parent.js')});
const html=await readFile('expressions-app/field-studies-journeys/public/index.html');
const server=createServer(async(req,res)=>{try{
 if(req.method==='POST'&&req.url==='/op'){
  const chunks=[];for await(const c of req)chunks.push(c);const bytes=Buffer.concat(chunks),op=JSON.parse(bytes);
  const operation=op.request?.request?.command?.operation??op.request?.operation??op.op,start=performance.now();
  const response=await fetch(`${endpoint}/op`,{method:'POST',headers:{'content-type':'application/json'},body:bytes});const result=await response.json();
  timings.push({operation,elapsed:performance.now()-start});
  const data=result.outcome?.data;
  if(data?.schema==='oi.native-expression-open/v1')opens++;
  if(data?.schema==='oi.native-expression-closed/v1')closes++;
  if(data?.field&&['m1-advance','read'].includes(operation))wire.push({operation,generation:data.field.generation,targets:data.field.targets.map(t=>t.position)});
  if(wire.length>8)wire.shift();
  res.setHeader('content-type','application/json');res.end(JSON.stringify(result));return;
 }
 if(req.url==='/parent.js'){res.setHeader('content-type','text/javascript');res.end(await readFile(join(temp,'parent.js')));return;}
 res.setHeader('content-type','text/html');res.end(req.url?.startsWith('/app')?html:'<!doctype html><style>body{margin:0}iframe{border:0;width:100vw;height:100vh}</style><iframe src="/app?host=expressions"></iframe><script type="module" src="/parent.js"></script>');
 }catch(error){res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:false,error:String(error)}));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const hardwareGPU=process.env.NATIVE_EXPRESSION_GPU==='hardware';
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:hardwareGPU?[]:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
report.browser=browser.version();
// Seeded particle initialisation and a record of every PCM block the page schedules.
const probe=`(()=>{let s=0x2f6e2b1;Math.random=function(){s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
 window.__PCM__=[];const copy=AudioBuffer.prototype.copyToChannel;AudioBuffer.prototype.copyToChannel=function(source,channel,offset){if(source&&source.length>=128&&window.__PCM__.length<64)window.__PCM__.push(Array.from(source));return copy.call(this,source,channel,offset);};})();`;
const settle=ms=>new Promise(r=>setTimeout(r,ms));
async function run(label,vary){
 const context=await browser.newContext({viewport:{width:1100,height:800},reducedMotion:'reduce'});
 await context.addInitScript(probe);
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(String(error)));
 try{
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const frame=page.frames().find(f=>f!==page.mainFrame());
  const dismiss=frame.locator('#entry-gate:not([hidden]) [data-action="entry-dismiss"]');
  if(await dismiss.count()){await dismiss.click();await frame.waitForFunction(()=>document.querySelector('#entry-gate')?.hasAttribute('hidden'),null,{timeout:5000});}
  await frame.waitForFunction(()=>window.__FIELD_STUDIES__?.native()?.renderer_requirements?.slot_count>0,null,{timeout:60000});
  if(!report.webgl)report.webgl=await frame.evaluate(()=>{for(const canvas of document.querySelectorAll('canvas')){const gl=canvas.getContext('webgl2')||canvas.getContext('webgl');if(gl){const ext=gl.getExtension('WEBGL_debug_renderer_info');return{vendor:gl.getParameter(ext?ext.UNMASKED_VENDOR_WEBGL:gl.VENDOR),renderer:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER)};}}return{renderer:'unavailable'};});
  report.topology??=await frame.evaluate(()=>window.__FIELD_STUDIES__.native().renderer_requirements);
  const toggle=frame.locator('.workspace-cluster>.header-menu-toggle');if(await toggle.isVisible())await toggle.click({force:true});
  await frame.locator('[data-action="studio"]').click({force:true});
  await frame.locator('[data-action="studio-section"][data-value="native"]').click({force:true});
  await frame.locator('.native-field-panel [data-ni="open"]').waitFor();
  if(label==='control-a')await page.screenshot({path:join(out,'instrument-closed.png')});
  await frame.locator('.native-field-panel summary',{hasText:'Other openings'}).click();
  await frame.locator('[data-ni="open-default"]').click();
  try{await frame.waitForFunction(()=>['held','following','unavailable'].includes(window.__FIELD_STUDIES__.native().status)&&(window.__FIELD_STUDIES__.native().instrument?.influence||window.__FIELD_STUDIES__.native().status==='unavailable'),null,{timeout:60000});}
  catch(error){const r=await frame.evaluate(()=>{const n=window.__FIELD_STUDIES__.native();return{status:n.status,reason:n.reason};});await page.screenshot({path:join(out,`failure-${label}.png`)});throw new Error(`instrument did not open: ${JSON.stringify(r)}`);}
  const opened=await frame.evaluate(()=>window.__FIELD_STUDIES__.native());
  assert.equal(opened.status,'held',`admission under reduced motion holds before any pump: ${opened.reason}`);
  assert.equal(opened.native.acknowledged.samples_elapsed,'0');
  const influence0=opened.instrument.influence,targets0=await frame.evaluate(()=>Array.from(window.__FIELD_STUDIES__.nativeTargets().target_a)),admitted0=await frame.evaluate(()=>Array.from(window.__FIELD_STUDIES__.nativeTargets().admitted_a));
  if(vary){
   if(disconnect)await frame.evaluate(()=>{window.__OI_TEST_DISCONNECT_NATIVE_TARGETS__=true;});
   await frame.locator('[data-ni="step"]').click();
   await frame.waitForFunction(m1=>window.__FIELD_STUDIES__.native().instrument?.influence?.m1_revision!==m1,influence0.m1_revision,{timeout:30000});
   await page.screenshot({path:join(out,disconnect?'varied-disconnected.png':'instrument-after-step.png')});
  }
  const held=await frame.evaluate(()=>window.__FIELD_STUDIES__.native());
  assert.equal(held.status,'held','the determinant commits while held');
  const influence1=held.instrument.influence,targets1=await frame.evaluate(()=>Array.from(window.__FIELD_STUDIES__.nativeTargets().target_a)),admitted1=await frame.evaluate(()=>Array.from(window.__FIELD_STUDIES__.nativeTargets().admitted_a));
  const steps=await frame.evaluate(({steps,dt})=>window.__FIELD_STUDIES__.probeSteps(steps,dt),{steps:STEPS,dt:DT});
  const gpu=await frame.evaluate(()=>{const s=window.__FIELD_STUDIES__.inspect(true);return{positions:s.positions,steps:s.steps,simTime:s.simTime};});
  const pixels=await frame.evaluate(()=>{const c=window.__FIELD_STUDIES__.capture(320,240);const x=c.getContext('2d');return Array.from(x.getImageData(0,0,c.width,c.height).data);});
  // Sound: resume following, then read the PCM blocks the page actually scheduled.
  const before=await frame.evaluate(()=>window.__PCM__.length);
  await frame.locator('[data-ni="resume"]').click();
  await frame.waitForFunction(()=>window.__FIELD_STUDIES__.native().status==='following',null,{timeout:15000});
  await frame.waitForFunction(n=>window.__PCM__.length>=n+5,before,{timeout:30000});
  const pcm=(await frame.evaluate(()=>window.__PCM__)).slice(before,before+5).flat();
  if(label==='varied'&&!disconnect){
   await frame.locator('.native-field-panel [data-ni-v="status"]').scrollIntoViewIfNeeded();await settle(400);await page.screenshot({path:join(out,'instrument-acting.png')});
   await frame.locator('.native-field-panel [data-ni-group="lens"]').scrollIntoViewIfNeeded();await page.screenshot({path:join(out,'instrument-determinants.png')});
   await frame.locator('summary',{hasText:'Inspect basis'}).click();await settle(300);
   await frame.locator('.native-field-panel .ni-effects').scrollIntoViewIfNeeded();await page.screenshot({path:join(out,'instrument-inspect-basis.png')});}
  const closed=closes;await frame.locator('[data-ni="close"]').click();
  await frame.waitForFunction(()=>window.__FIELD_STUDIES__.native().status==='manual',null,{timeout:15000});
  for(let i=0;i<200&&closes===closed;i++)await settle(25);
  assert.equal(closes,closed+1,'the owner is released exactly once before the next run');
  assert.deepEqual(errors,[]);
  return{label,scale:held.presentation_units_per_metre,influence0,influence1,targets0,targets1,admitted0,admitted1,steps,gpu,pixels,pcm,particles:report.topology.particle_count};
 }finally{await context.close();}
}
/** The live cadence on the real owner: following, not held; beats skip while
 * the owner is busy. Reported as measured, asserted only for its law. */
async function cadence(){
 const context=await browser.newContext({viewport:{width:1100,height:800}});
 await context.addInitScript(probe);
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(String(error)));
 try{
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const frame=page.frames().find(f=>f!==page.mainFrame());
  const dismiss=frame.locator('#entry-gate:not([hidden]) [data-action="entry-dismiss"]');
  if(await dismiss.count()){await dismiss.click();await frame.waitForFunction(()=>document.querySelector('#entry-gate')?.hasAttribute('hidden'),null,{timeout:5000});}
  await frame.waitForFunction(()=>window.__FIELD_STUDIES__?.native()?.renderer_requirements?.slot_count>0,null,{timeout:60000});
  const toggle=frame.locator('.workspace-cluster>.header-menu-toggle');if(await toggle.isVisible())await toggle.click({force:true});
  await frame.locator('[data-action="studio"]').click({force:true});
  await frame.locator('[data-action="studio-section"][data-value="native"]').click({force:true});
  await frame.locator('.native-field-panel summary',{hasText:'Other openings'}).click();
  await frame.locator('[data-ni="open-default"]').click();
  await frame.waitForFunction(()=>window.__FIELD_STUDIES__.native().status==='following'&&window.__FIELD_STUDIES__.native().instrument?.influence,null,{timeout:60000});
  const result={};
  // Idle baseline: no determinant events. Device re-syncs here belong to the
  // page (main-thread render cost), not to the instrument's events.
  {const e0=await frame.evaluate(()=>window.__FIELD_STUDIES__.native().native.audio?.device_epoch);await settle(8000);
   const e1=await frame.evaluate(()=>window.__FIELD_STUDIES__.native().native.audio?.device_epoch);result.idle_baseline={seconds:8,device_epoch_before:e0,device_epoch_after:e1};}
  for(const rate of ['1','12']){
   const m1=await frame.evaluate(()=>window.__FIELD_STUDIES__.native().instrument.influence.m1_revision);
   const epoch0=await frame.evaluate(()=>window.__FIELD_STUDIES__.native().native.audio?.device_epoch);
   await frame.evaluate(()=>{const log=window.__epochLog=[];let last=null;let lastApplied=null,minAhead=9;window.__epochWatch=setInterval(()=>{const n=window.__FIELD_STUDIES__.native(),a=n.native?.audio,applied=n.instrument?.cadence?.applied;if(!a)return;const ahead=a.target_context_seconds-a.observed_context_seconds;minAhead=Math.min(minAhead,ahead);if(a.device_epoch!==last||applied!==lastApplied){log.push({t:performance.now()|0,epoch:a.device_epoch,applied,status:a.status,ahead:+ahead.toFixed(3),min_ahead_since_last:+minAhead.toFixed(3)});last=a.device_epoch;lastApplied=applied;minAhead=9;}},5);});
   await frame.locator(`[data-ni-set="cadence"][data-value="${rate}"]`).click();
   await settle(8000);
   const epochLog=await frame.evaluate(()=>{clearInterval(window.__epochWatch);return window.__epochLog;});
   await frame.locator('[data-ni-set="cadence"][data-value="hold"]').click();
   // A beat already in flight lands and counts; wait for the owner to settle.
   await frame.waitForFunction(m1=>{const n=window.__FIELD_STUDIES__.native(),c=n.instrument.cadence;return BigInt(n.instrument.influence.m1_revision)-BigInt(m1)===BigInt(c.applied)&&!n.native.in_flight;},m1,{timeout:10000}).catch(()=>{});
   const r=await frame.evaluate(()=>{const n=window.__FIELD_STUDIES__.native();return{status:n.status,reason:n.reason,cadence:n.instrument.cadence,refusal:n.instrument.refusal,m1_revision:n.instrument.influence.m1_revision,audio:n.native.audio};});
   result[`${rate}_per_second`]={status:r.status,m1_revision_before:m1,m1_revision_after:r.m1_revision,applied:r.cadence.applied,skipped:r.cadence.skipped,beats:r.cadence.beats,achieved_ticks_per_second:r.cadence.achieved_ticks_per_second,last_event_ms:r.cadence.last_event_ms,last_event_timing:r.cadence.last_event_timing,max_event_ms:r.cadence.max_event_ms,refusal:r.refusal,audio_device_epoch_before:epoch0,epoch_log:epochLog,audio_device_epoch:r.audio?.device_epoch,audio_scheduled_blocks:r.audio?.scheduled_blocks,audio_receipt:r.audio};
   assert.equal(r.status,'following',`cadence ${rate}/s keeps the field following: ${r.reason}`);
   assert.equal(r.refusal,null);assert.ok(r.cadence.applied>=1);
   assert.equal(BigInt(r.m1_revision)-BigInt(m1),BigInt(r.cadence.applied),'every applied beat is one M1 revision; none replayed');
  }
  await frame.locator('[data-ni-set="cadence"][data-value="12"]').scrollIntoViewIfNeeded();await page.screenshot({path:join(out,'instrument-cadence.png')});
  const closed=closes;await frame.locator('[data-ni="close"]').click();
  for(let i=0;i<200&&closes===closed;i++)await settle(25);
  assert.deepEqual(errors,[]);
  return result;
 }finally{await context.close();}
}
const top=influence=>influence.voices.reduce((a,v)=>v.frequency_hz>a.frequency_hz?v:a);
/** Peak frequency near `hz` (±2%) by a Hann-windowed DFT scan, parabolic refined. */
function peakNear(pcm,rate,hz){
 const n=Math.min(pcm.length,32768),w=Array.from({length:n},(_,i)=>pcm[i]*(0.5-0.5*Math.cos(2*Math.PI*i/(n-1))));
 const power=f=>{let re=0,im=0;const k=2*Math.PI*f/rate;for(let i=0;i<n;i++){re+=w[i]*Math.cos(k*i);im-=w[i]*Math.sin(k*i);}return re*re+im*im;};
 const step=rate/n/4;let best=hz,bestP=-1;
 for(let f=hz*0.98;f<=hz*1.02;f+=step){const p=power(f);if(p>bestP){bestP=p;best=f;}}
 const a=power(best-step),b=bestP,c=power(best+step),d=(a-c)/(2*(a-2*b+c)||1);
 return{frequency_hz:best+d*step,power:b};
}
const meanAbs=(x,y,n)=>{let s=0;for(let i=0;i<n;i++)s+=Math.abs(x[i]-y[i]);return s/n;};
const maxAbs=(x,y,n)=>{let m=0;for(let i=0;i<n;i++)m=Math.max(m,Math.abs(x[i]-y[i]));return m;};
/** Cosine between the control→varied particle displacement and the target change. */
function alignment(a,v,t0,t1,count){let dot=0,na=0,nb=0;for(let p=0;p<count;p++)for(let k=0;k<3;k++){const i=p*4+k,x=v[i]-a[i],y=t1[i]-t0[i];dot+=x*y;na+=x*x;nb+=y*y;}return dot/Math.sqrt(na*nb||1);}
function meanDistance(positions,targets,count){let s=0;for(let p=0;p<count;p++){const i=p*4;s+=Math.hypot(positions[i]-targets[i],positions[i+1]-targets[i+1],positions[i+2]-targets[i+2]);}return s/count;}
function check(ok,text,detail){(ok?report.checks:report.failures).push(detail?{check:text,...detail}:text);}
try{
 const a=await run('control-a',false),b=await run('control-b',false),v=await run('varied',true);
 const n=a.particles*4;
 // 1. Producer: the one owner's influence reading names the changed voices.
 const hz0=a.influence1.voices.map(x=>x.frequency_hz),hz1=v.influence1.voices.map(x=>x.frequency_hz);
 const shape0=a.influence1.voices.map(x=>`${x.m}x${x.n}`),shape1=v.influence1.voices.map(x=>`${x.m}x${x.n}`);
 report.producer={control:{m1_revision:a.influence1.m1_revision,address72:a.influence1.address72,voices_hz:hz0,nodal:shape0},varied:{m1_revision:v.influence1.m1_revision,address72:v.influence1.address72,voices_hz:hz1,nodal:shape1}};
 assert.deepEqual(a.influence0.voices,v.influence0.voices,'every run opens the same owner state');
 check(hz0.length===9&&hz0.every((f,i)=>f===hz1[i])&&shape0.join()!==shape1.join(),'producer: one M1 advance reshapes the skin of the same nine planet voices; the sky keeps their pitch',{nodal_changed:shape0.filter((s,i)=>s!==shape1[i]).length});
 // 2. Transfer: the admitted native frame (metres, at slots) changed in the page;
 // 3. delivery: the GPU-bound target textures (presentation units) changed.
 const admittedSame=maxAbs(a.admitted0,v.admitted0,n),admittedDelta=maxAbs(a.admitted1,v.admitted1,n);
 const targetsSame=maxAbs(a.targets0,v.targets0,n),targetsDelta=maxAbs(a.targets1,v.targets1,n);
 report.transfer={opening_admitted_max_abs_difference_m:admittedSame,after_step_admitted_max_abs_difference_m:admittedDelta,wire_frames:wire.map(w=>({operation:w.operation,generation:w.generation}))};
 report.delivery={opening_gpu_target_max_abs_difference:targetsSame,after_step_gpu_target_max_abs_difference:targetsDelta,after_step_gpu_target_mean_abs_difference:meanAbs(a.targets1,v.targets1,n)};
 check(admittedSame===0&&admittedDelta>0,'transfer: opening frames identical; the post-determinant native frame admitted into the page differs',{admittedDelta});
 check(targetsSame===0&&targetsDelta>0,'delivery: the GPU-bound target textures carry the changed frame',{targetsDelta});
 // 3. GPU: resident particles after N fixed steps, against the A/B determinism baseline.
 const baseline=maxAbs(a.gpu.positions,b.gpu.positions,n),effect=meanAbs(a.gpu.positions,v.gpu.positions,n),effectMax=maxAbs(a.gpu.positions,v.gpu.positions,n);
 const tolerance=Math.max(1e-3,10*baseline);
 // The intended targets are the admitted frames at the presentation scale,
 // whether or not the GPU-bound textures received them.
 const intendedOld=a.admitted1.map(x=>x*a.scale),intendedNew=v.admitted1.map(x=>x*v.scale);
 const toward={displacement_target_change_cosine:alignment(a.gpu.positions,v.gpu.positions,intendedOld,intendedNew,a.particles),varied_to_new_targets:meanDistance(v.gpu.positions,intendedNew,a.particles),control_to_new_targets:meanDistance(a.gpu.positions,intendedNew,a.particles),control_to_own_targets:meanDistance(a.gpu.positions,intendedOld,a.particles)};
 report.gpu={steps:{control:a.gpu.steps,varied:v.gpu.steps},baseline_max_abs_difference:baseline,tolerance,effect_mean_abs_difference:effect,effect_max_abs_difference:effectMax,toward};
 check(effect>tolerance,'GPU: particle positions after N fixed steps differ from control beyond the determinism baseline',{effect,tolerance});
 check(toward.displacement_target_change_cosine>0.1&&toward.varied_to_new_targets<toward.control_to_new_targets,'GPU: particles move toward the new targets (displacement aligned with the target change; nearer the new targets than control)',toward);
 // 4. Presentation: canvas pixels and scheduled PCM.
 const pixelBaseline=a.pixels.reduce((s,x,i)=>s+(x!==b.pixels[i]?1:0),0),pixelEffect=a.pixels.reduce((s,x,i)=>s+(x!==v.pixels[i]?1:0),0);
 report.pixels={baseline_differing_channels:pixelBaseline,effect_differing_channels:pixelEffect,total_channels:a.pixels.length};
 check(pixelEffect>pixelBaseline,'presentation: canvas pixels differ from control beyond the baseline',{pixelEffect,pixelBaseline});
 const rate=48000,topA=top(a.influence1),topV=top(v.influence1);
 const heardA=peakNear(a.pcm,rate,topA.frequency_hz),heardV=peakNear(v.pcm,rate,topV.frequency_hz);
 const error=Math.abs(heardV.frequency_hz-topV.frequency_hz)/topV.frequency_hz;
 report.audio={samples_analysed:Math.min(v.pcm.length,32768),control_top_voice_hz:topA.frequency_hz,varied_top_voice_hz:topV.frequency_hz,
  control_measured_hz:heardA.frequency_hz,varied_measured_hz:heardV.frequency_hz,varied_relative_error:error,
  control_relative_error:Math.abs(heardA.frequency_hz-topA.frequency_hz)/topA.frequency_hz,
  standing:'frequency of PCM blocks the page scheduled on its Web Audio graph (muted); not speaker output'};
 check(error<0.01&&topA.frequency_hz===topV.frequency_hz&&report.audio.control_relative_error<0.01,'audio: both runs\' scheduled PCM carries the sky\'s top voice within 1%; the determinant left its pitch held',{measured:heardV.frequency_hz,expected:topV.frequency_hz,error});
 report.requests={opens,closes};
 report.measurement={latency_by_operation:Object.fromEntries([...new Set(timings.map(t=>t.operation))].map(op=>{const values=timings.filter(t=>t.operation===op).map(t=>t.elapsed).sort((x,y)=>x-y);return[op,{count:values.length,mean_ms:values.reduce((s,x)=>s+x,0)/values.length,max_ms:values.at(-1)}];}))};
 if(!disconnect){report.cadence=await cadence();check(true,'cadence: 1 and 12 ticks/s on the real owner stay following; applied beats equal M1 revisions; busy beats skipped',report.cadence);}
 assert.equal(opens,disconnect?3:4);assert.equal(closes,disconnect?3:4);
 report.pass=report.failures.length===0;
 console.log(JSON.stringify(report,null,2));
 assert.deepEqual(report.failures,[],'every layer must carry the determinant');
}catch(error){report.failure=String(error);throw error;}
finally{
 await writeFile(join(out,disconnect?'scene-trace-disconnected.json':'scene-trace.json'),JSON.stringify(report,null,2)+'\n');await writeFile(join(out,'kernel.log'),bridgeLog+'\n'+bridgeErr);
 await browser.close();await new Promise(r=>server.close(r));bridge.kill();await rm(temp,{recursive:true,force:true});
}
