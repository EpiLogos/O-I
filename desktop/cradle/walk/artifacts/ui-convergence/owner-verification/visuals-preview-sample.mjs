import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
const repo='/Users/admin/Central/Work/O-I/.aikit/tasks/ui-expression-convergence';
const root=repo+'/desktop/cradle';
const {createServer}=await import(pathToFileURL(root+'/node_modules/vite/dist/node/index.js'));
const {chromium}=await import(pathToFileURL(root+'/node_modules/playwright/index.mjs'));
const sourcePaths=['desktop/cradle/src/workspace/settings/VisualsView.tsx','desktop/cradle/src/stage/ExpressionStage.tsx','desktop/cradle/src/stage/engineSurface.ts','desktop/cradle/src/visuals/store.ts','desktop/cradle/tests/visuals-preview-page.tsx','packages/oi-design-system/expressions-engine/engine/entityRuntime.mjs','packages/oi-design-system/expressions-engine/PROVENANCE.json','desktop/cradle/package-lock.json'];
const sources={};
for(const path of sourcePaths)sources[path]=createHash('sha256').update(await readFile(repo+'/'+path)).digest('hex');
const report={head:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),sources,
  interpretation:'One bounded actual Visuals settings component sample with real providers/native engine, after initial frame warmup. Chromium ANGLE SwiftShader is software rendering; no physical GPU or cross-machine extrapolation. Other desktop work may run concurrently; renderer TaskDuration excludes the software GPU process.',
  measuredAt:new Date().toISOString()};
const server=await createServer({root,appType:'custom',server:{host:'127.0.0.1',port:0},logLevel:'error'});
server.middlewares.use('/visuals-sample',async(_,res)=>{res.setHeader('content-type','text/html');res.end(await server.transformIndexHtml('/visuals-sample','<body class="oi-desktop"><div id="root"></div><script type="module" src="/tests/visuals-preview-page.tsx"></script>'));});
await server.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
const context=await browser.newContext({viewport:{width:1280,height:820},reducedMotion:'no-preference'});
const page=await context.newPage();
const errors=[];page.on('pageerror',error=>errors.push(error.message));
await context.addInitScript(()=>{
 localStorage.setItem('oi-cradle.visuals.v1',JSON.stringify({enabled:false,welcomeEnabled:false}));
 window.contexts=new Map();window.fired=0;
 const originalRAF=requestAnimationFrame.bind(window);window.requestAnimationFrame=callback=>originalRAF(time=>{window.fired++;callback(time);});
 const original=HTMLCanvasElement.prototype.getContext;
 HTMLCanvasElement.prototype.getContext=function(type,...args){const result=original.call(this,type,...args);if(result&&(type==='webgl2'||type==='webgl'))contexts.set(this,result);return result;};
});
const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
const readCPU=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
async function sample(ms){
 const cpuBefore=await readCPU();
 const data=await page.evaluate(async(ms)=>{
   const start=performance.now(),before=previewTest.stage.inspect(),raf=fired;
   await new Promise(resolve=>setTimeout(resolve,ms));
   const end=performance.now(),after=previewTest.stage.inspect();
   const live=[...contexts].filter(([canvas])=>canvas.isConnected);
   return {elapsedMs:end-start,particleCount:previewTest.visuals.get().config.particleCount,frames:after.frames===null?null:after.frames-before.frames,rafCallbacks:fired-raf,
     stage:{presentations:after.presentations,live:after.live,scheduled:after.scheduled,paused:after.paused},connectedCanvases:document.querySelectorAll('canvas').length,connectedWebGLContexts:live.length,
     instrumentedUnlostContexts:[...contexts.values()].filter(gl=>!gl.isContextLost()).length};
 },ms);
 const cpuAfter=await readCPU();data.rendererTaskSeconds=cpuAfter.TaskDuration-cpuBefore.TaskDuration;data.rendererTaskPercent=data.rendererTaskSeconds/(data.elapsedMs/1000)*100;
 return data;
}
try{
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/visuals-sample`);
 await page.getByRole('button',{name:'Expression: Off',exact:true}).click();
 await page.waitForFunction(()=>previewTest.stage.inspect().frames>5,null,{polling:100,timeout:60000});
 report.active=await sample(5000);
 await page.getByRole('button',{name:'Themes',exact:true}).click();
 await page.waitForFunction(()=>!previewTest.stage.inspect().scheduled&&previewTest.stage.inspect().live===false,null,{polling:100});
 report.released=await sample(2500);
 await page.evaluate(()=>previewTest.visuals.setEnabled(false));
 await page.waitForFunction(()=>!previewTest.stage.inspect().engine,null,{polling:100});
 report.disabled=await sample(500);
 report.errors=errors;
 await writeFile('/tmp/oi-ui-owner-verification-20260915/visuals-preview-sample.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}finally{await browser.close();await server.close();}
