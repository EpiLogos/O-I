/**
 * The engine surface's clock law, proved on a real WebGL page (the same
 * harness as expression-stage-placement.mjs):
 *   present → frames flow;                release → settle, then sleep
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
const server=await createServer({root,appType:'custom',server:{host:'127.0.0.1',port:0},logLevel:'error'});
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
/** Frames fired over a quiet window, plus the surface's own reading. */
const observe=async(ms=600)=>page.evaluate(async(ms)=>{
 const before=window.__raf.fired,framesBefore=window.stageSurface.frameCount;
 await new Promise((resolve)=>setTimeout(resolve,ms));
 const canvas=document.querySelector('canvas[data-oi-stage="engine"]');
 return {rafFired:window.__raf.fired-before,frames:window.stageSurface.frameCount-framesBefore,live:window.stageSurface.isLive,scheduled:window.stageSurface.isScheduled,paused:window.stageSurface.isPaused,dormant:canvas?canvas.dataset.oiStageLive==="false":null,canvasPresent:!!canvas,errors:window.failures};
},ms);
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
 // Software GL compiles the field's shaders lazily over the first frames
 // (a several-hundred-millisecond stall right after the first render);
 // observe the clock once the pipeline is warm, not during its warm-up.
 await page.waitForFunction(()=>window.stageSurface.frameCount>10,null,{timeout:20000});
 state=await observe(800);
 check(state.rafFired>=2&&state.frames>=2&&state.live&&state.dormant===false,`A live presentation runs the clock: ${JSON.stringify(state)}`);
 check(state.errors.length===0,'No engine error while presenting');

 // The native palette can override the engine's automatic monochrome ink.
 // Both the actual GPU palette and ground must follow the host's roles.
 await page.addStyleTag({url:'/node_modules/@epilogos/oi-design-system/tokens.css'});
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

 // release: the field settles (bounded), then sleeps.
 await page.evaluate(()=>window.stageSurface.release('welcome.mark'));
 state=await observe(300);
 check(!state.live,'A released presentation is not live');
 // Wait out the settle window, then demand silence.
 await page.waitForFunction(()=>!window.stageSurface.isScheduled,{timeout:5000});
 state=await observe(800);
 check(state.rafFired===0&&state.frames===0&&!state.scheduled,`A released field sleeps — no continuing simulation frames: ${JSON.stringify(state)}`);
 check(state.dormant===true,'A released field is marked dormant');
 const identity=await page.evaluate(()=>({sameCanvas:window.stageSurface.canvas===window.originalCanvas,sameContext:window.stageSurface.canvas.getContext('webgl2')===window.originalContext,count:document.querySelectorAll('canvas[data-oi-stage="engine"]').length}));
 check(identity.sameCanvas&&identity.sameContext&&identity.count===1,'Dormancy keeps the one canvas and context (no teardown, no duplicate)');

 // re-entry: presenting again on the same surface resumes the clock.
 await page.evaluate(()=>window.stageSurface.present('again','oi.mark'));
 await page.waitForFunction(()=>window.stageSurface.isScheduled);
 state=await observe(600);
 check(state.rafFired>=2&&state.live&&state.dormant===false,`Re-entry resumes frames on the same surface: ${JSON.stringify(state)}`);

 // hidden document: nothing is scheduled while hidden; visible resumes.
 const hiddenCancelled=await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));return !window.stageSurface.isScheduled;});
 check(hiddenCancelled,'Visibility change cancels the pending drawing frame immediately');
 await page.waitForFunction(()=>!window.stageSurface.isScheduled,{timeout:2000});
 state=await observe(600);
 check(state.rafFired===0&&!state.scheduled&&state.live,`A hidden window burns no drawing frames while its presentation stays live: ${JSON.stringify(state)}`);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForFunction(()=>window.stageSurface.isScheduled,{timeout:2000});
 state=await observe(600);
 check(state.rafFired>=2,`A window made visible again resumes its live field: ${JSON.stringify(state)}`);

 // paused: the clock is held; resume restarts it.
 await page.evaluate(()=>window.stageSurface.setPaused(true));
 state=await observe(500);
 check(state.rafFired===0&&!state.scheduled&&state.paused,`A paused field schedules nothing: ${JSON.stringify(state)}`);
 await page.evaluate(()=>window.stageSurface.setPaused(false));
 await page.waitForFunction(()=>window.stageSurface.isScheduled,{timeout:2000});
 state=await observe(500);
 check(state.rafFired>=2,`A resumed field runs again: ${JSON.stringify(state)}`);

 // reduced motion: one still frame per change, no continuous clock.
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.waitForFunction(()=>!window.stageSurface.isScheduled,{timeout:2000});
 state=await observe(600);
 check(state.rafFired===0&&state.live&&!state.scheduled,`Reduced motion is genuinely reduced — a live field paints still, no loop: ${JSON.stringify(state)}`);
 const before=await page.evaluate(()=>window.stageSurface.frameCount);
 await page.evaluate(()=>window.stageSurface.update('again','oi.mark'));
 await page.waitForFunction((before)=>window.stageSurface.frameCount>before,before,{timeout:2000});
 await page.waitForFunction(()=>!window.stageSurface.isScheduled,{timeout:2000});
 state=await observe(500);
 check(state.rafFired===0,`Under reduced motion a change paints one frame and stops again: ${JSON.stringify(state)}`);
 // release under reduced motion: dormant at once, no settle loop.
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
