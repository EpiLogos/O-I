import {chromium} from '/Users/admin/Central/Work/O-I/.aikit/tasks/ui-expression-convergence/desktop/cradle/node_modules/playwright/index.mjs';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const cradle='/Users/admin/Central/Work/O-I/.aikit/tasks/ui-expression-convergence/desktop/cradle';
const dir='/tmp/oi-ui-parity-20260915',home=await mkdtemp('/tmp/oi-opening-kernel-');
const bridge='http://127.0.0.1:4330',url='http://127.0.0.1:4321';
const service=spawn('cargo',['run','--quiet','--manifest-path','kernel/Cargo.toml','--bin','walk-bridge','--','127.0.0.1:4330'],{cwd:cradle,env:{...process.env,OI_HOME:home,OI_CENTRAL_ROOT:'/Users/admin/Central',CARGO_TARGET_DIR:'/Users/admin/Central/Work/O-I/desktop/cradle/kernel/target',CARGO_INCREMENTAL:'0',OI_AIKIT_BIN:'/Users/admin/.cargo/bin/aikit',OI_CENTRAL_CTRL_BIN:'/Users/admin/.local/bin/ctrl'},stdio:['ignore','pipe','pipe']});
let serviceLog='';service.stdout.on('data',d=>serviceLog+=d);service.stderr.on('data',d=>serviceLog+=d);
let browser;const results=[];
try{
 const deadline=Date.now()+180000;while(true){try{if((await fetch(bridge+'/state')).ok)break;}catch{}if(Date.now()>deadline)throw new Error('Real kernel bridge timeout '+serviceLog.slice(-2000));await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width:1280,height:820},deviceScaleFactor:2,reducedMotion:'no-preference'});
  const page=await context.newPage();const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
  await page.addInitScript(({bridge,theme})=>{
   window.__OI_KERNEL_BRIDGE__=bridge;
   localStorage.setItem('oi-cradle.visuals.v1',JSON.stringify({theme}));
   const obs=window.__openingTrace={events:[],draws:[],resources:[],longTasks:[],contexts:[],raf:0};
   const mark=(name,data={})=>obs.events.push({name,at:performance.now(),...data});
   const states=new WeakMap();
   const getContext=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(type,...args){const context=getContext.call(this,type,...args);if(context&&(type==='webgl2'||type==='webgl')&&!states.has(context)){states.set(context,{framebuffer:null});obs.contexts.push({canvas:this,context});mark('webgl-context',{kind:type});}return context;};
   const proto=WebGL2RenderingContext.prototype;
   const bind=proto.bindFramebuffer;proto.bindFramebuffer=function(target,buffer){const s=states.get(this);if(s&&(target===this.FRAMEBUFFER||target===this.DRAW_FRAMEBUFFER))s.framebuffer=buffer;return bind.call(this,target,buffer);};
   let lastDraw=-1;
   for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){
    const draw=proto[name];proto[name]=function(...args){const result=draw.apply(this,args),s=states.get(this);if(s&&!s.framebuffer&&this.canvas.dataset.oiStage==='engine'&&obs.raf!==lastDraw){lastDraw=obs.raf;const at=performance.now();obs.draws.push({at,raf:obs.raf});if(obs.draws.length===1)mark('native-first-framebuffer-draw');}return result;};
   }
   const raf=window.requestAnimationFrame;window.requestAnimationFrame=callback=>raf(time=>{obs.raf++;callback(time);});
   new PerformanceObserver(list=>{for(const e of list.getEntries())obs.resources.push({name:e.name,startTime:e.startTime,responseEnd:e.responseEnd,duration:e.duration,transferSize:e.transferSize});}).observe({type:'resource',buffered:true});
   new PerformanceObserver(list=>{for(const e of list.getEntries())obs.longTasks.push({startTime:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:true});
   const seen=new Set();const check=()=>{for(const [name,selector] of [['welcome','.oi-welcome'],['field-ready','.oi-welcome[data-field-ready="true"]'],['workspace-wrapper','.oi-workspace-mount'],['workspace-composed','.desktop-shell'],['ready-control','.oi-welcome-enter[aria-label="O:I is ready. Open the app."]'],['entering','.oi-welcome[data-phase="entering"]']])if(!seen.has(name)&&document.querySelector(selector)){seen.add(name);mark(name);}if(seen.has('entering')&&!seen.has('entered')&&!document.querySelector('.oi-welcome')){seen.add('entered');mark('entered');}};
   new MutationObserver(check).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-field-ready','data-phase','aria-label']});
   document.addEventListener('click',event=>{if(event.target.closest?.('.oi-welcome-enter'))mark('enter-click');},true);
  },{bridge,theme});
  await page.goto(url+'?frontstate',{waitUntil:'domcontentloaded'});
  await page.locator('.oi-welcome-enter[aria-label="O:I is ready. Open the app."]').waitFor({timeout:90000});
  await page.waitForTimeout(1500);
  const before=await page.evaluate(async()=>({stage:(await window.__cradle.walk.read.stage()).data,covered:!!document.querySelector('.oi-workspace-mount[inert][aria-hidden="true"]')}));
  await page.locator('.oi-welcome-enter').click();
  await page.locator('.oi-welcome').waitFor({state:'detached',timeout:30000});
  await page.waitForTimeout(1200);
  const after=await page.evaluate(async()=>({stage:(await window.__cradle.walk.read.stage()).data,focused:document.activeElement?.id||document.activeElement?.className,legacy:document.querySelectorAll('svg.oi-expression,canvas:not([data-oi-stage="engine"])').length}));
  const trace=await page.evaluate(()=>{const t=window.__openingTrace;return {...t,contexts:t.contexts.map(({canvas,context:gl})=>{const e=gl.getExtension('WEBGL_debug_renderer_info');return {connected:canvas.isConnected,lost:gl.isContextLost(),width:canvas.width,height:canvas.height,renderer:e&&gl.getParameter(e.UNMASKED_RENDERER_WEBGL)};})};});
  await page.screenshot({path:dir+'/opening-'+theme+'-entered.png'});
  const result={theme,before,after,trace,pageErrors};results.push(result);console.log(JSON.stringify({theme,before,after,events:trace.events,draws:trace.draws.length,contexts:trace.contexts,longTasks:trace.longTasks,pageErrors}));
  await context.close();
 }
}finally{
 await browser?.close();service.kill('SIGTERM');await writeFile(dir+'/opening-kernel.log',serviceLog);
 const index=await readFile(cradle+'/dist/index.html');
 await writeFile(dir+'/opening.json',JSON.stringify({url,bridge,home,distIndexSha256:createHash('sha256').update(index).digest('hex'),results},null,2));
}
