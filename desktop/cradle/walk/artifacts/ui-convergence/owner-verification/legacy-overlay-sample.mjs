import {pathToFileURL} from 'node:url';
import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const repo='/Users/admin/Central/Work/O-I/.aikit/tasks/ui-expression-convergence',root=repo+'/desktop/cradle';
const {createServer}=await import(pathToFileURL(root+'/node_modules/vite/dist/node/index.js'));
const {chromium}=await import(pathToFileURL(root+'/node_modules/playwright/index.mjs'));
const component=`import React,{useLayoutEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {KernelProvider} from '/src/kernel/KernelProvider';
import {VisualsProvider} from '/src/visuals/ParticleExpression';
import {visuals} from '/src/visuals/store';
import {ExpressionStageProvider,useExpressionStage} from '/src/stage/ExpressionStage';
import {ExpressionAnchor} from '/src/shared/Expression';
import '@epilogos/oi-design-system/tokens.css';
function Probe(){const stage=useExpressionStage(),[show,setShow]=useState(true);useLayoutEffect(()=>{window.legacy={stage,visuals};});return <><button onClick={()=>setShow(!show)}>{show?'Hide anchor':'Show anchor'}</button>{show&&<ExpressionAnchor form="idle"/>}</>}
createRoot(document.getElementById('root')).render(<React.StrictMode><KernelProvider><VisualsProvider><ExpressionStageProvider><Probe/></ExpressionStageProvider></VisualsProvider></KernelProvider></React.StrictMode>);`;
const virtual=root+'/tests/__legacy-map.tsx';
const server=await createServer({root,appType:'custom',server:{host:'127.0.0.1',port:0},logLevel:'error',plugins:[{name:'legacy-map-only',enforce:'pre',resolveId(id){if(id==='/legacy-map.tsx')return virtual;},load(id){if(id===virtual)return component;}}]});
server.middlewares.use('/legacy-map',async(_,res)=>{res.setHeader('content-type','text/html');res.end(await server.transformIndexHtml('/legacy-map','<body class="oi-desktop"><div id="root"></div><script type="module" src="/legacy-map.tsx"></script>'));});
await server.listen();
const browser=await chromium.launch({headless:true});const page=await browser.newPage({reducedMotion:'no-preference'});
await page.addInitScript(()=>{localStorage.setItem('oi-cradle.visuals.v1',JSON.stringify({enabled:false,welcomeEnabled:false}));window.fired=0;const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=callback=>raf(t=>{fired++;callback(t);});});
async function sample(ms){return await page.evaluate(async(ms)=>{const before=legacy.stage.inspect().overlay.frames,raf=fired,start=performance.now();await new Promise(r=>setTimeout(r,ms));const stage=legacy.stage.inspect();return {elapsedMs:performance.now()-start,windowRaf:fired-raf,overlayFrames:stage.overlay.frames-before,enabled:legacy.visuals.get().enabled,engine:stage.engine,overlay:stage.overlay,canvases:document.querySelectorAll('canvas').length};},ms);}
try{
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/legacy-map`);
 await page.waitForFunction(()=>window.legacy?.stage.inspect().overlay?.frames>2,null,{polling:100});
 const report={sourceHead:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),kind:'Actual ExpressionAnchor, providers and DS Canvas2D renderer; controlled idle component state, no claimed native Agent operation.',activeWhileDisabled:await sample(1200)};
 await page.getByRole('button',{name:'Hide anchor'}).click();report.unmounted=await sample(500);
 await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Show anchor'}).click();report.reduced=await sample(500);
 await writeFile('/tmp/oi-ui-owner-verification-20260915/legacy-overlay-sample.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();await server.close();}
