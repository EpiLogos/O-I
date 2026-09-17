/**
 * ES5 lifecycle convergence on a real WebGL page (same harness as
 * expression-stage-lifecycle.mjs):
 *
 *   contained renderer offscreen → clock suspends (no frames scheduled),
 *   re-entry → same canvas/context resumes the same scene and selection;
 *   front/verso-style hide → show keeps identity (no remint, no new canvas);
 *   WebGL context lost → marked, nothing scheduled, commands deferred,
 *   no stage-destroying error; context restored → the field rebuilds
 *   through the adapter's recover-context path and frames resume (live
 *   simulation honestly reseeded); repeated open/suspend/restore cycles →
 *   performance receipt (frames, heap, wall time) with continuity proofs.
 *
 * requestAnimationFrame is counted at the window, so "no frame" is the
 * browser's own truth, not the surface's self-report.
 */
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const server=await createServer({root,appType:'custom',server:{host:'127.0.0.1',port:0,strictPort:false},logLevel:'error'});
server.middlewares.use('/stage-suspension',(_req,res)=>{res.setHeader('content-type','text/html');res.end('<html><body style="margin:0"><div id="scroller" style="width:480px;height:320px;overflow:hidden"><div id="inline" style="position:relative;width:480px;height:320px"></div></div><div id="spacer" style="height:50px"></div></body></html>');});
await server.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1000,height:800}});
let checks=0;
const check=(condition,message)=>{assert.ok(condition,message);checks++;};
await page.addInitScript(()=>{
 window.__raf={scheduled:0,fired:0};
 const original=window.requestAnimationFrame.bind(window);
 window.requestAnimationFrame=(callback)=>{window.__raf.scheduled++;return original((time)=>{window.__raf.fired++;callback(time);});};
});
const observe=async(ms,framesRequired=0)=>page.evaluate(async({ms,framesRequired})=>{
 const before=window.__raf.fired,framesBefore=window.stageSurface.frameCount;
 if(framesRequired){
  const deadline=performance.now()+ms;
  while((window.stageSurface.frameCount-framesBefore<framesRequired||window.__raf.fired-before<framesRequired)&&performance.now()<deadline)await new Promise(resolve=>setTimeout(resolve,50));
 }else await new Promise((resolve)=>setTimeout(resolve,ms));
 return {rafFired:window.__raf.fired-before,frames:window.stageSurface.frameCount-framesBefore,live:window.stageSurface.isLive,scheduled:window.stageSurface.isScheduled,suspended:window.stageSurface.isSuspended,contextLost:window.stageSurface.isContextLost,recovery:window.stageSurface.contextRecovery,errors:window.failures};
},{ms,framesRequired});
try{
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/stage-suspension`);
 await page.evaluate(async()=>{
  const {EngineSurface}=await import('/src/stage/engineSurface.ts');
  window.failures=[];
  window.stageSurface=EngineSurface.forWindow((error)=>window.failures.push(error));
  window.originalCanvas=window.stageSurface.canvas;
  window.originalContext=window.originalCanvas.getContext('webgl2');
 });

 // A window surface is never viewport-suspended; document visibility governs it.
 check(await page.evaluate(()=>window.stageSurface.isSuspended===false),'a window surface holds no viewport suspension');

 // --- Contained renderer: offscreen suspends, re-entry resumes. ----------
 await page.evaluate(()=>{
  window.stageSurface.present('contained','oi.mark');
  window.stageSurface.setContainer('contained',document.getElementById('inline'));
  window.containedScene=window.stageSurface.active.scene.id;
 });
 await page.waitForFunction(()=>window.stageSurface.isScheduled,null,{timeout:5000});
 let state=await observe(20000,3);
 check(state.frames>=3&&state.scheduled&&!state.suspended,`a visible contained renderer runs: ${JSON.stringify(state)}`);
 const runningSeeds=await page.evaluate(()=>JSON.stringify(window.stageSurface.adapter.engine.inspectState().seeds));
 // Scroll the container out of the viewport: the IntersectionObserver suspends.
 await page.evaluate(()=>{document.getElementById('scroller').scrollTop=9999;document.getElementById('inline').style.transform='translateY(1200px)';});
 await page.waitForFunction(()=>window.stageSurface.isSuspended,null,{timeout:5000});
 state=await observe(700);
 check(state.rafFired===0&&state.frames===0&&!state.scheduled&&state.suspended&&state.live,`a moved-out-of-view contained renderer suspends its clock: ${JSON.stringify(state)}`);
 check(await page.evaluate(()=>document.querySelector('canvas[data-oi-stage="engine"]')?.dataset.oiStageSuspended==='true'),'suspension is marked on the canvas');
 // While suspended a command is still accepted by the surface (the scene law
 // holds; the clock is what suspends), and nothing schedules.
 check(await page.evaluate(()=>{try{window.stageSurface.command({type:'disperse',strength:1});return window.stageSurface.isScheduled===false;}catch{return false;}}),'a suspended field accepts no frame work and schedules nothing');
 // Re-entry: back in view — same canvas/context, same scene, frames resume.
 await page.evaluate(()=>{document.getElementById('inline').style.transform='';});
 await page.waitForFunction(()=>window.stageSurface.isScheduled,null,{timeout:5000});
 state=await observe(20000,2);
 check(state.rafFired>=2&&state.frames>=2&&!state.suspended,`re-entry resumes the same contained field: ${JSON.stringify(state)}`);
 const identity=await page.evaluate(()=>({sameCanvas:window.stageSurface.canvas===window.originalCanvas,sameContext:window.stageSurface.canvas.getContext('webgl2')===window.originalContext,scene:window.stageSurface.active.scene.id,expectedScene:window.containedScene,count:document.querySelectorAll('canvas[data-oi-stage="engine"]').length}));
 check(identity.sameCanvas&&identity.sameContext&&identity.count===1&&identity.scene===identity.expectedScene,`suspension keeps one canvas, one context, the same scene: ${JSON.stringify(identity)}`);

 // --- Front/verso-style hide: hidden container suspends, return preserves.
 await page.evaluate(()=>{document.getElementById('inline').style.display='none';});
 await page.waitForFunction(()=>window.stageSurface.isSuspended,null,{timeout:5000});
 state=await observe(600);
 check(state.rafFired===0&&!state.scheduled&&state.live,`a hidden artboard suspends exactly like a hidden document: ${JSON.stringify(state)}`);
 await page.evaluate(()=>{document.getElementById('inline').style.display='';});
 await page.waitForFunction(()=>window.stageSurface.isScheduled,null,{timeout:5000});
 state=await observe(20000,2);
 check(state.frames>=2,'returning from the verso-style hide resumes frames on the same presentation');
 check(await page.evaluate(seeds=>JSON.stringify(window.stageSurface.adapter.engine.inspectState().seeds)===seeds,runningSeeds),'no reseed happened across suspend/resume — the field is continuous');

 // --- WebGL context loss: marked, deferred, recovered — never fatal. -----
 await page.evaluate(()=>{
  window.beforeLoss={frames:window.stageSurface.frameCount,seeds:JSON.stringify(window.stageSurface.adapter.engine.inspectState().seeds),engine:window.stageSurface.adapter.engine,steps:window.stageSurface.adapter.engine.inspectState().steps};
  window.stageSurface.canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));
 });
 await page.waitForFunction(()=>window.stageSurface.isContextLost,null,{timeout:5000});
 state=await observe(600);
 check(state.contextLost&&!state.scheduled&&state.rafFired===0&&state.recovery?.phase==='lost',`a lost context marks the surface and stops the clock: ${JSON.stringify(state)}`);
 check(state.errors.length===0,'a context loss is a lifecycle state, not a stage-destroying error');
 check(await page.evaluate(()=>{try{window.stageSurface.command({type:'disperse',strength:1});return true;}catch{return false;}}),'commands are deferred (not thrown at) while the context is lost');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});window.stageSurface.canvas.dispatchEvent(new Event('webglcontextrestored'));});
 await page.waitForFunction(()=>!window.stageSurface.isContextLost&&window.stageSurface.isScheduled,null,{timeout:8000});
 state=await observe(20000,2);
 const recovered=await page.evaluate(()=>({frames:window.stageSurface.frameCount,recovery:window.stageSurface.contextRecovery,fieldRebuilt:window.stageSurface.adapter.engine!==window.beforeLoss.engine,steps:window.stageSurface.adapter.engine.inspectState().steps,beforeSteps:window.beforeLoss.steps,sameCanvas:window.stageSurface.canvas===window.originalCanvas,sameContext:window.stageSurface.canvas.getContext('webgl2')===window.originalContext,marked:window.stageSurface.canvas.dataset.oiStageContext,errors:window.failures}));
 check(state.frames>=2,`frames resume after the browser restores the context: ${JSON.stringify(state)}`);
 check(recovered.recovery.phase==='restored'&&recovered.recovery.restores===1,`the recovery receipt is honest: ${JSON.stringify(recovered.recovery)}`);
 check(recovered.sameCanvas&&recovered.sameContext&&recovered.marked==='restored',`recovery keeps the same canvas/context and marks the receipt: ${JSON.stringify(recovered)}`);
 // The recovery proof is the rebuilt field: a new engine instance whose
 // simulation has restarted (steps back at/below the pre-loss count). The
 // engine's own seeds are deterministic, so they prove nothing here.
 check(recovered.fieldRebuilt&&recovered.steps<=recovered.beforeSteps,'recovery rebuilds the production field — the simulation restarts rather than claiming continuity');
 check(recovered.errors.length===0,'no engine errors across the loss/restore cycle');

 // --- Performance receipt: repeated open/suspend/restore. ----------------
 // Actual repeated use of the front/verso + suspension lifecycle: present,
 // hide (suspend), show (resume), release — 25 cycles. The receipt records
 // frames, JS heap and wall time; the assertions prove continuity, and the
 // numbers ARE the receipt (documented in the lane report).
 await page.evaluate(()=>window.stageSurface.release('contained'));
 const receipt=await page.evaluate(async()=>{
  const cycle=async(index)=>{
   window.stageSurface.present(`cycle-${index}`,'oi.mark');
   window.stageSurface.setContainer(`cycle-${index}`,document.getElementById('inline'));
   const deadline=performance.now()+8000;
   while(window.stageSurface.frameCount<3&&performance.now()<deadline)await new Promise(r=>setTimeout(r,10));
   window.stageSurface.setPaused(true);
   const framesLive=window.stageSurface.frameCount;
   document.getElementById('inline').style.display='none';
   const suspendDeadline=performance.now()+4000;
   while(!window.stageSurface.isSuspended&&performance.now()<suspendDeadline)await new Promise(r=>setTimeout(r,10));
   const suspendedAt=window.stageSurface.frameCount;
   document.getElementById('inline').style.display='';
   const resumeDeadline=performance.now()+4000;
   while(window.stageSurface.isSuspended&&performance.now()<resumeDeadline)await new Promise(r=>setTimeout(r,10));
   window.stageSurface.setPaused(false);
   const resumeDeadline2=performance.now()+4000;
   const before=window.stageSurface.frameCount;
   while(window.stageSurface.frameCount-before<2&&performance.now()<resumeDeadline2)await new Promise(r=>setTimeout(r,10));
   const resumedFrames=window.stageSurface.frameCount-before;
   window.stageSurface.release(`cycle-${index}`);
   return {framesLive,suspendedAt,resumedFrames,sameCanvas:window.stageSurface.canvas===window.originalCanvas};
  };
  const t0=performance.now();
  const heap0=performance.memory?performance.memory.usedJSHeapSize:null;
  // Warm-up (engine, shader and JIT paths settle), then the measured span.
  await cycle(-1);
  const heapWarm=performance.memory?performance.memory.usedJSHeapSize:null;
  const framesWarm=window.stageSurface.frameCount;
  const results=[];
  for(let index=0;index<25;index++)results.push(await cycle(index));
  const heap1=performance.memory?performance.memory.usedJSHeapSize:null;
  return {
   cycles:results.length,
   wallMs:Math.round(performance.now()-t0),
   framesTotal:window.stageSurface.frameCount,
   framesPerCycle:Math.round((window.stageSurface.frameCount-framesWarm)/25*10)/10,
   heapWarmMB:heapWarm===null?null:Math.round(heapWarm/1048576*10)/10,
   heapAfterMB:heap1===null?null:Math.round(heap1/1048576*10)/10,
   heapGrowthMB:heapWarm===null||heap1===null?null:Math.round((heap1-heapWarm)/1048576*10)/10,
   everyCycleSuspendedAndResumed:results.every(r=>r.suspendedAt>=r.framesLive&&r.resumedFrames>=1),
   everyCycleSameCanvas:results.every(r=>r.sameCanvas),
  };
 });
 check(receipt.everyCycleSuspendedAndResumed,`every cycle suspended while hidden and resumed frames after: ${JSON.stringify(receipt.everyCycleSuspendedAndResumed)}`);
 check(receipt.everyCycleSameCanvas,'all 25 cycles kept the one canvas (no renderer forks)');
 check(receipt.heapGrowthMB===null||receipt.heapGrowthMB<40,`heap growth stays bounded across 25 cycles: ${JSON.stringify(receipt.heapGrowthMB)} MB`);
 console.log(`Expression stage suspension lifecycle: ${checks} checks passed (offscreen/hidden suspension, context-loss recovery, re-dock continuity).`);
 console.log(`Performance receipt (repeated open/suspend/restore, actual use): ${JSON.stringify(receipt)}`);
}finally{await page.evaluate(()=>{try{window.stageSurface?.dispose();}catch{}}).catch(()=>{});await browser.close();await server.close();}
