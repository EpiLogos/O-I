/**
 * The engine surface's clock law, proved on a real WebGL page (the same
 * harness as expression-stage-placement.mjs):
 *   present → frames flow;                release → cancel and sleep immediately
 *   released field: no scheduled frame,   canvas marked dormant, same canvas/context
 *   re-entry (present again): frames resume on the same canvas/context
 *   hidden document: nothing scheduled;   visible again: frames resume
 *   paused: nothing scheduled;            resumed: frames resume
 *   reduced motion: one still frame per wake, no continuous clock
 *   disabled (dispose): canvas removed, nothing scheduled
 * requestAnimationFrame is counted at the window, so "no frame" is the
 * browser's own truth, not the surface's self-report.
 */
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const server=await createServer({root,appType:'custom',server:{host:'127.0.0.1',port:4387,strictPort:true},logLevel:'error'});
server.middlewares.use('/stage-lifecycle',(_req,res)=>{res.setHeader('content-type','text/html');res.end('<html><body style="margin:0"><div id="inline" style="position:relative;width:480px;height:320px"></div></body></html>');});
await server.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1000,height:800}});
let checks=0;
const check=(condition,message)=>{assert.ok(condition,message);checks++;};
// The window-level frame counter: installed before any module loads.
await page.addInitScript(()=>{
 window.__raf={scheduled:0,fired:0};
 const original=window.requestAnimationFrame.bind(window);
 window.requestAnimationFrame=(callback)=>{window.__raf.scheduled++;return original((time)=>{window.__raf.fired++;callback(time);});};
});
/** Idle needs an observation window; activity needs actual multi-frame
 * progress. Software GL speed is not a lifecycle invariant. */
const observe=async(ms=600,framesRequired=0)=>page.evaluate(async({ms,framesRequired})=>{
 const before=window.__raf.fired,framesBefore=window.stageSurface.frameCount;
 if(framesRequired){
  const deadline=performance.now()+ms;
  while((window.stageSurface.frameCount-framesBefore<framesRequired||window.__raf.fired-before<framesRequired)&&performance.now()<deadline)await new Promise(resolve=>setTimeout(resolve,50));
 }else await new Promise((resolve)=>setTimeout(resolve,ms));
 const canvas=document.querySelector('canvas[data-oi-stage="engine"]');
 return {rafFired:window.__raf.fired-before,frames:window.stageSurface.frameCount-framesBefore,live:window.stageSurface.isLive,scheduled:window.stageSurface.isScheduled,paused:window.stageSurface.isPaused,dormant:canvas?canvas.dataset.oiStageLive==="false":null,canvasPresent:!!canvas,errors:window.failures};
},{ms,framesRequired});
try{
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/stage-lifecycle`);
 await page.evaluate(async()=>{
  const {EngineSurface}=await import('/src/stage/engineSurface.ts');
  window.failures=[];window.stageSurface=EngineSurface.forWindow((error)=>window.failures.push(error));
  window.originalCanvas=window.stageSurface.canvas;window.originalContext=window.originalCanvas.getContext('webgl2');
 });
 // Created but nothing presented: dormant from the first moment.
 let state=await observe(400);
 check(state.rafFired===0&&!state.scheduled&&!state.live,`A surface with nothing to express schedules no frame: ${JSON.stringify(state)}`);
 check(state.dormant===true,'An unpresented surface is marked dormant');

 // welcome → enter: a live presentation drives frames.
 await page.evaluate(()=>window.stageSurface.present('welcome.mark','oi.mark'));
 state=await observe(20000,2);
 check(state.rafFired>=2&&state.frames>=2&&state.live&&state.dormant===false,`A live presentation runs the clock: ${JSON.stringify(state)}`);
 check(state.errors.length===0,'No engine error while presenting');

 // The native palette can override the engine's automatic monochrome ink.
 // Both the actual GPU palette and ground must follow the host's roles.
 await page.addStyleTag({url:'/node_modules/@epilogos/oi-design-system/tokens.css'});
 await page.addStyleTag({url:'/node_modules/@epilogos/oi-design-system/point-cloud.css'});
 await page.evaluate(()=>document.body.classList.add('oi-desktop'));
 const palette=()=>page.evaluate(()=>({
   ink:window.stageSurface.adapter.engine.particleMaterial.uniforms.uPrimaryColor.value.getHexString(),
   expected:getComputedStyle(document.body).getPropertyValue('--oi-foreground').trim().slice(1),
   background:window.stageSurface.adapter.engine.config.backgroundColor,
   expectedBackground:getComputedStyle(document.body).getPropertyValue('--oi-canvas-ground').trim(),
 }));
 await page.waitForFunction(()=>window.stageSurface.adapter.engine.config.backgroundColor===getComputedStyle(document.body).getPropertyValue('--oi-canvas-ground').trim());
 let colours=await palette();
 check(colours.ink===colours.expected&&colours.background===colours.expectedBackground,`Light recipe uses host ink and paper: ${JSON.stringify(colours)}`);
 await page.evaluate(()=>document.body.dataset.theme='dark');
 await page.waitForFunction(()=>window.stageSurface.adapter.engine.config.backgroundColor===getComputedStyle(document.body).getPropertyValue('--oi-canvas-ground').trim());
 colours=await palette();
 check(colours.ink===colours.expected&&colours.background===colours.expectedBackground,`Dark recipe uses inverse ink and paper: ${JSON.stringify(colours)}`);

 // Release during actual playback cancels the promise immediately. Read
 // the real GPU positions/velocities before and after: preserving a canvas
 // alone would not prove that an idle replacement scene stopped reseeding.
 await page.evaluate(()=>{
  window.cancelResolutions=0;
  window.enterPlayback=stageSurface.play('welcome.mark','welcome.enter').then(result=>{window.cancelResolutions++;return result;});
 });
 await page.waitForFunction(()=>stageSurface.inspectPlayback()?.elapsed>0);
 const immediate=await page.evaluate(()=>{
  const engine=stageSurface.adapter.engine,simulator=engine.simulator;
  window.beforeRelease={engine,simulator,scene:stageSurface.active.scene,
   buffers:[simulator.posTarget0,simulator.posTarget1,simulator.velTarget0,simulator.velTarget1],
   resident:engine.inspectState(true),frames:stageSurface.frameCount};
  stageSurface.release('welcome.mark');
  return {live:stageSurface.isLive,scheduled:stageSurface.isScheduled,
   frames:stageSurface.frameCount-beforeRelease.frames,sameScene:stageSurface.active.scene===beforeRelease.scene,
   dormant:stageSurface.canvas.dataset.oiStageLive==='false'};
 });
 check(!immediate.live&&!immediate.scheduled&&immediate.frames===0&&immediate.dormant,'Release immediately cancels the pending frame and marks the field dormant');
 check(immediate.sameScene,'Release does not replace the last real scene with an idle scene');
 check((await page.evaluate(()=>window.enterPlayback)).status==='cancelled','Releasing an active sequence resolves cancellation');
 await page.evaluate(()=>stageSurface.release('welcome.mark'));
 check(await page.evaluate(()=>window.cancelResolutions===1),'Repeated release does not resolve playback twice');
 state=await observe(800);
 check(state.rafFired===0&&state.frames===0&&!state.scheduled,`Release has no settle loop or continuing simulation frames: ${JSON.stringify(state)}`);
 const retained=await page.evaluate(()=>{
  const before=beforeRelease,engine=stageSurface.adapter.engine,simulator=engine.simulator,after=engine.inspectState(true);
  const equal=(a,b)=>a.length===b.length&&a.every((value,index)=>Object.is(value,b[index]));
  return {native:engine===before.engine&&simulator===before.simulator,
   buffers:[simulator.posTarget0,simulator.posTarget1,simulator.velTarget0,simulator.velTarget1].every((buffer,index)=>buffer===before.buffers[index]),
   positions:equal(before.resident.positions,after.positions),velocities:equal(before.resident.velocities,after.velocities),
   seeds:after.seeds===before.resident.seeds,steps:after.steps===before.resident.steps,simTime:after.simTime===before.resident.simTime};
 });
 check(Object.values(retained).every(Boolean),`Release preserves the actual GPU buffers and resident state: ${JSON.stringify(retained)}`);
 const identity=await page.evaluate(()=>({sameCanvas:stageSurface.canvas===originalCanvas,sameContext:stageSurface.canvas.getContext('webgl2')===originalContext,count:document.querySelectorAll('canvas[data-oi-stage="engine"]').length}));
 check(identity.sameCanvas&&identity.sameContext&&identity.count===1,'Dormancy keeps the one canvas and context');

 // A release before the first permitted frame must reject readiness without
 // materialising a new field. No substituted scheduler or renderer.
 const cancelledReady=await page.evaluate(async()=>{
  const before=stageSurface.frameCount;
  stageSurface.present('not-drawn','oi.mark');
  const ready=stageSurface.whenReady('not-drawn').then(()=>({resolved:true}),error=>({resolved:false,message:error.message}));
  stageSurface.release('not-drawn');
  return {...await ready,frames:stageSurface.frameCount-before,scheduled:stageSurface.isScheduled};
 });
 check(!cancelledReady.resolved&&cancelledReady.message.includes('released')&&cancelledReady.frames===0&&!cancelledReady.scheduled,'Unpainted release rejects readiness and cancels its first frame');

 // Paused admission still paints the actual initial state, and a real
 // viewport resize reprojects once without advancing the simulation.
 const pausedBefore=await page.evaluate(()=>{
  stageSurface.setPaused(true);
  const before={frames:stageSurface.frameCount,steps:stageSurface.adapter.engine.inspectState().steps};
  stageSurface.present('paused-admission','oi.mark');return before;
 });
 await page.evaluate(()=>stageSurface.whenReady('paused-admission'));
 let pausedState=await page.evaluate(()=>({frames:stageSurface.frameCount,steps:stageSurface.adapter.engine.inspectState().steps,scheduled:stageSurface.isScheduled}));
 check(pausedState.frames>pausedBefore.frames&&pausedState.steps===pausedBefore.steps&&!pausedState.scheduled,'Paused admission resolves ready only after a real still frame, without simulation');
 await page.setViewportSize({width:820,height:640});
 await page.waitForFunction(()=>stageSurface.canvas.width===820&&stageSurface.canvas.height===640);
 pausedState=await page.evaluate(()=>({frames:stageSurface.frameCount,steps:stageSurface.adapter.engine.inspectState().steps,scheduled:stageSurface.isScheduled}));
 check(pausedState.steps===pausedBefore.steps&&!pausedState.scheduled,'Paused viewport resize updates native backing dimensions without a simulation step');
 await page.evaluate(()=>{stageSurface.release('paused-admission');stageSurface.setPaused(false);});

 // re-entry: presenting again on the same surface resumes the clock.
 await page.evaluate(()=>window.stageSurface.present('again','oi.mark'));
 await page.waitForFunction(()=>window.stageSurface.isScheduled);
 state=await observe(20000,2);
 check(state.rafFired>=2&&state.live&&state.dormant===false,`Re-entry resumes frames on the same surface: ${JSON.stringify(state)}`);
 check(await page.evaluate(()=>stageSurface.adapter.engine===beforeRelease.engine&&stageSurface.adapter.engine.simulator===beforeRelease.simulator&&stageSurface.adapter.engine.inspectState().seeds===beforeRelease.resident.seeds),'Re-entry retains the native engine, simulator and persistent seeds');

 // hidden document: nothing is scheduled while hidden; visible resumes.
 const hiddenCancelled=await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));return !window.stageSurface.isScheduled;});
 check(hiddenCancelled,'Visibility change cancels the pending drawing frame immediately');
 await page.waitForFunction(()=>!window.stageSurface.isScheduled,null,{timeout:2000});
 state=await observe(600);
 check(state.rafFired===0&&!state.scheduled&&state.live,`A hidden window burns no drawing frames while its presentation stays live: ${JSON.stringify(state)}`);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForFunction(()=>window.stageSurface.isScheduled,null,{timeout:2000});
 state=await observe(20000,2);
 check(state.rafFired>=2,`A window made visible again resumes its live field: ${JSON.stringify(state)}`);

 // paused: the clock is held; resume restarts it.
 await page.evaluate(()=>window.stageSurface.setPaused(true));
 state=await observe(500);
 check(state.rafFired===0&&!state.scheduled&&state.paused,`A paused field schedules nothing: ${JSON.stringify(state)}`);
 await page.evaluate(()=>window.stageSurface.setPaused(false));
 await page.waitForFunction(()=>window.stageSurface.isScheduled,null,{timeout:2000});
 state=await observe(20000,2);
 check(state.rafFired>=2,`A resumed field runs again: ${JSON.stringify(state)}`);

 // reduced motion: one still frame per change, no continuous clock.
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.waitForFunction(()=>!window.stageSurface.isScheduled,null,{timeout:2000});
 state=await observe(600);
 check(state.rafFired===0&&state.live&&!state.scheduled,`Reduced motion is genuinely reduced — a live field paints still, no loop: ${JSON.stringify(state)}`);
 const before=await page.evaluate(()=>window.stageSurface.frameCount);
 await page.evaluate(()=>window.stageSurface.update('again','oi.mark'));
 await page.waitForFunction((before)=>window.stageSurface.frameCount>before,before,{timeout:2000});
 await page.waitForFunction(()=>!window.stageSurface.isScheduled,null,{timeout:2000});
 state=await observe(500);
 check(state.rafFired===0,`Under reduced motion a change paints one frame and stops again: ${JSON.stringify(state)}`);
 // Release under reduced motion is dormant immediately too.
 await page.evaluate(()=>window.stageSurface.release('again'));
 state=await observe(500);
 check(state.rafFired===0&&state.dormant===true&&!state.live,`A release under reduced motion goes dormant at once: ${JSON.stringify(state)}`);
 await page.emulateMedia({reducedMotion:'no-preference'});

 // disabled: dispose removes the canvas and schedules nothing.
 await page.evaluate(()=>window.stageSurface.dispose());
 state=await page.evaluate(async()=>{const before=window.__raf.fired;await new Promise((resolve)=>setTimeout(resolve,400));return {rafFired:window.__raf.fired-before,canvases:document.querySelectorAll('canvas[data-oi-stage="engine"]').length,scheduled:window.stageSurface.isScheduled};});
 check(state.rafFired===0&&state.canvases===0&&!state.scheduled,`Disabling removes the canvas and leaves no clock behind: ${JSON.stringify(state)}`);
 console.log(`Expression stage lifecycle: ${checks} clock-law checks passed on a real WebGL surface (live/release/re-entry/hidden/paused/reduced/disposed).`);
}finally{await page.evaluate(()=>{try{window.stageSurface?.dispose();}catch{}}).catch(()=>{});await browser.close();await server.close();}
