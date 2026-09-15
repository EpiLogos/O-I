import {chromium} from '/Users/admin/Central/Work/O-I/.aikit/tasks/ui-expression-convergence/desktop/cradle/node_modules/playwright/index.mjs';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const cradle='/Users/admin/Central/Work/O-I/.aikit/tasks/ui-expression-convergence/desktop/cradle';
const dir='/tmp/oi-ui-final-opening-20260915',home=await mkdtemp('/tmp/oi-final-opening-kernel-');
const bridge='http://127.0.0.1:4330',url='http://127.0.0.1:4321';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const basis={head:execFileSync('git',['rev-parse','HEAD'],{cwd:cradle,encoding:'utf8'}).trim(),status:execFileSync('git',['status','--short'],{cwd:cradle,encoding:'utf8'}),engine:JSON.parse(await readFile(cradle+'/../../packages/oi-design-system/expressions-engine/PROVENANCE.json','utf8')),indexSha256:hash(await readFile(cradle+'/dist/index.html')),viewport:{width:1280,height:820},deviceScaleFactor:2};
basis.sourceHashes={};
basis.acceptedOiMain=execFileSync('git',['rev-parse','origin/main'],{cwd:cradle,encoding:'utf8'}).trim();
for(const file of ['index.html','src/Cradle.tsx','src/visuals/WelcomeField.tsx','src/stage/ExpressionStage.tsx','src/stage/engineSurface.ts','src/stage/recipes.ts','src/visuals/oi-logo-state.json'])basis.sourceHashes[file]=hash(await readFile(cradle+'/'+file));
basis.authoredLogoParticleCount=JSON.parse(await readFile(cradle+'/src/visuals/oi-logo-state.json','utf8')).config.particleCount;
await writeFile(dir+'/concurrency-before.txt',execFileSync('ps',['-axo','pid,ppid,%cpu,etime,command'],{encoding:'utf8'}));
const service=spawn('cargo',['run','--quiet','--manifest-path','kernel/Cargo.toml','--bin','walk-bridge','--','127.0.0.1:4330'],{cwd:cradle,env:{...process.env,OI_HOME:home,OI_CENTRAL_ROOT:'/Users/admin/Central',CARGO_TARGET_DIR:'/Users/admin/Central/Work/O-I/desktop/cradle/kernel/target',CARGO_INCREMENTAL:'0',OI_AIKIT_BIN:'/Users/admin/.cargo/bin/aikit',OI_CENTRAL_CTRL_BIN:'/Users/admin/.local/bin/ctrl'},stdio:['ignore','pipe','pipe']});
let serviceLog='';service.stdout.on('data',d=>serviceLog+=d);service.stderr.on('data',d=>serviceLog+=d);
let browser;const results=[];const assetHashes={};
try{
 const deadline=Date.now()+180000;while(true){try{if((await fetch(bridge+'/state')).ok)break;}catch{}if(Date.now()>deadline)throw new Error('Real kernel bridge timeout '+serviceLog.slice(-2000));await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 basis.browser=browser.version();
 const session=await browser.newBrowserCDPSession();basis.gpu=await session.send('SystemInfo.getInfo');await session.detach();
 for(const [name,theme,enabled] of [['light','light',true],['dark','dark',true],['disabled','light',false]]){
  const context=await browser.newContext({viewport:basis.viewport,deviceScaleFactor:2,reducedMotion:'no-preference'});
  const page=await context.newPage(),pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
  await page.addInitScript(({bridge,theme,enabled})=>{
   window.__OI_KERNEL_BRIDGE__=bridge;
   localStorage.setItem('oi-cradle.visuals.v1',JSON.stringify({theme,enabled}));
   const obs=window.__openingTrace={events:[],draws:[],resources:[],longTasks:[],contexts:[],raf:0};
   const mark=(name,data={})=>obs.events.push({name,at:performance.now(),...data});
   const states=new WeakMap(),getContext=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(type,...args){const context=getContext.call(this,type,...args);if(context&&(type==='webgl2'||type==='webgl')&&!states.has(context)){states.set(context,{framebuffer:null,clearColor:null});obs.contexts.push({canvas:this,context});mark('webgl-context',{kind:type});}return context;};
   let lastDraw=-1;
   for(const proto of [WebGL2RenderingContext.prototype,WebGLRenderingContext.prototype]){
    const bind=proto.bindFramebuffer;proto.bindFramebuffer=function(target,buffer){const s=states.get(this);if(s&&(target===this.FRAMEBUFFER||target===this.DRAW_FRAMEBUFFER))s.framebuffer=buffer;return bind.call(this,target,buffer);};
    const clearColor=proto.clearColor;proto.clearColor=function(...values){const s=states.get(this);if(s)s.clearColor=values;return clearColor.apply(this,values);};
    for(const method of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){
     const draw=proto[method];if(!draw)continue;
     proto[method]=function(...args){const result=draw.apply(this,args),s=states.get(this);if(s&&!s.framebuffer&&this.canvas.dataset.oiStage==='engine'&&obs.raf!==lastDraw){lastDraw=obs.raf;obs.draws.push({at:performance.now(),raf:obs.raf});if(obs.draws.length===1)mark('native-first-framebuffer-draw',{clearColor:s.clearColor});}return result;};
    }
   }
   const raf=window.requestAnimationFrame;window.requestAnimationFrame=callback=>raf(time=>{obs.raf++;callback(time);});
   new PerformanceObserver(list=>{for(const e of list.getEntries())obs.resources.push({name:e.name,startTime:e.startTime,responseEnd:e.responseEnd,duration:e.duration,transferSize:e.transferSize});}).observe({type:'resource',buffered:true});
   new PerformanceObserver(list=>{for(const e of list.getEntries())obs.longTasks.push({startTime:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:true});
   const seen=new Set(),check=()=>{
    if(!seen.has('initial-ground')&&document.body){seen.add('initial-ground');mark('initial-ground',{opening:document.body.dataset.oiOpening??null,theme:document.body.dataset.theme??'light',color:getComputedStyle(document.body).backgroundColor});}
    for(const [name,selector] of [['welcome','.oi-welcome'],['field-ready','.oi-welcome[data-field-ready="true"]'],['workspace-wrapper','.oi-workspace-mount'],['workspace-composed','.desktop-shell'],['ready-control','.oi-welcome-enter[aria-label="O:I is ready. Open the app."]'],['entering','.oi-welcome[data-phase="entering"]']])if(!seen.has(name)&&document.querySelector(selector)){seen.add(name);mark(name);}
    if(seen.has('entering')&&!seen.has('entered')&&!document.querySelector('.oi-welcome')){seen.add('entered');mark('entered');}
   };
   new MutationObserver(check).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-field-ready','data-phase','aria-label','data-oi-opening']});
   document.addEventListener('click',event=>{if(event.target.closest?.('.oi-welcome-enter'))mark('enter-click');},true);
  },{bridge,theme,enabled});
  await page.goto(url+'?frontstate',{waitUntil:'domcontentloaded'});
  const snapshot=()=>page.evaluate(async()=>({at:performance.now(),stage:(await window.__cradle.walk.read.stage()).data,covered:!!document.querySelector('.oi-workspace-mount[inert][aria-hidden="true"]'),canvases:document.querySelectorAll('canvas[data-oi-stage="engine"]').length,allCanvases:document.querySelectorAll('canvas').length,raf:window.__openingTrace.raf,draws:window.__openingTrace.draws.length,focused:document.activeElement?.id||document.activeElement?.className,legacy:document.querySelectorAll('svg.oi-expression,canvas:not([data-oi-stage="engine"])').length}));
  let before;
  if(enabled){
   await page.locator('.oi-welcome-enter[aria-label="O:I is ready. Open the app."]').waitFor({timeout:90000});
   await page.waitForTimeout(1500);before=await snapshot();
   await page.locator('.oi-welcome-enter').click();
   await page.locator('.oi-welcome').waitFor({state:'detached',timeout:30000});
  }else{
   await page.locator('.desktop-shell').waitFor({timeout:90000});
   await page.waitForFunction(()=>!!window.__cradle?.walk?.read?.stage);
   await page.waitForTimeout(500);before=await snapshot();
  }
  const idleStart=await snapshot();await page.waitForTimeout(1200);const after=await snapshot();
  const trace=await page.evaluate(()=>{const t=window.__openingTrace;return {...t,contexts:t.contexts.map(({canvas,context:gl})=>{const e=gl.getExtension('WEBGL_debug_renderer_info');return {connected:canvas.isConnected,lost:gl.isContextLost(),width:canvas.width,height:canvas.height,renderer:e&&gl.getParameter(e.UNMASKED_RENDERER_WEBGL)};})};});
  const result={name,theme,enabled,before,idleStart,after,trace,pageErrors};results.push(result);
  console.log(JSON.stringify({name,before,idleStart,after,events:trace.events,draws:trace.draws.length,contexts:trace.contexts,longTasks:trace.longTasks,pageErrors}));
  // Screenshots and resource byte hashing happen after each timing window.
  await page.screenshot({path:dir+'/opening-'+name+'-entered.png'});
  for(const resource of trace.resources){const path=new URL(resource.name).pathname;if(path.startsWith('/assets/')&&!(path in assetHashes))assetHashes[path]=hash(await readFile(cradle+'/dist'+path));}
  await context.close();
 }
}finally{
 await browser?.close();service.kill('SIGTERM');await writeFile(dir+'/opening-kernel.log',serviceLog);
 await writeFile(dir+'/concurrency-after.txt',execFileSync('ps',['-axo','pid,ppid,%cpu,etime,command'],{encoding:'utf8'}));
 basis.finalIndexSha256=hash(await readFile(cradle+'/dist/index.html'));
 await writeFile(dir+'/opening.json',JSON.stringify({url,bridge,home,basis,results},null,2));
 await writeFile(dir+'/opening-bundle-hashes.json',JSON.stringify(assetHashes,null,2));
 await rm(home,{recursive:true,force:true});
}
