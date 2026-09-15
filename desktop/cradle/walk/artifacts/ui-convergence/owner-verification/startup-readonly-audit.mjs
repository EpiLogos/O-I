import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFileSync,readdirSync,statSync,writeFileSync} from 'node:fs';
import {join,relative,extname} from 'node:path';
import {createHash} from 'node:crypto';
const repo='/Users/admin/Central/Work/O-I/.aikit/tasks/ui-expression-convergence';
const out='/tmp/oi-ui-owner-verification-20260915';
const require=createRequire(repo+'/desktop/cradle/package.json'),{chromium}=require('playwright');
const dir=repo+'/desktop/cradle/dist',files=new Map();
function read(dirPath){for(const name of readdirSync(dirPath)){const full=join(dirPath,name);if(statSync(full).isDirectory())read(full);else files.set('/'+relative(dir,full),readFileSync(full));}}read(dir);
const entry=files.get('/index.html').toString().match(/src="([^\"]+\.js)"/)[1];
const basis={entry,assets:Object.fromEntries([...files].map(([name,bytes])=>[name,{bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}]))};
writeFileSync(out+'/startup-audit-dist-basis.json',JSON.stringify(basis,null,2)+'\n');
const server=createServer((req,res)=>{const path=new URL(req.url,'http://localhost').pathname;const data=files.get(path==='/'?'/index.html':path);if(!data){res.statusCode=404;res.end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.woff':'font/woff','.svg':'image/svg+xml'})[extname(path)]??(path==='/'?'text/html':'application/octet-stream'));res.end(data);});
await new Promise(r=>server.listen(4392,'127.0.0.1',r));
const url='http://127.0.0.1:4392';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
const results=[];
try {
 for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width:960,height:680},reducedMotion:'reduce'});
  await context.addInitScript(theme=>localStorage.setItem('oi-cradle.visuals.v1',JSON.stringify({enabled:true,welcomeEnabled:true,theme})),theme);
  const page=await context.newPage();let unblock,blocked;
  const ready=new Promise(r=>blocked=r),gate=new Promise(r=>unblock=r);
  await page.route(url+entry,async route=>{blocked();await gate;await route.continue();});
  const navigation=page.goto(url,{waitUntil:'domcontentloaded'});
  await ready;
  await page.waitForFunction(()=>document.body&&getComputedStyle(document.body).backgroundColor!=='rgba(0, 0, 0, 0)');
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const before=await page.evaluate(()=>({body:getComputedStyle(document.body).backgroundColor,html:getComputedStyle(document.documentElement).backgroundColor,root:getComputedStyle(document.getElementById('root')).backgroundColor,appearance:document.body.dataset.theme??'light',inverse:getComputedStyle(document.body).getPropertyValue('--oi-inverse-canvas-ground').trim(),welcome:!!document.querySelector('.oi-welcome'),canvases:document.querySelectorAll('canvas').length,paints:performance.getEntriesByType('paint').map(p=>({name:p.name,startTime:p.startTime}))}));
  await page.screenshot({path:out+`/startup-${theme}-entry-delayed.png`});
  unblock();await navigation;
  await page.waitForSelector('.oi-welcome');
  await page.waitForFunction(()=>document.querySelector('.oi-welcome')?.dataset.fieldReady==='true'||document.querySelector('.oi-welcome')?.dataset.fieldError==='true',null,{timeout:30000});
  const after=await page.evaluate(()=>({body:getComputedStyle(document.body).backgroundColor,welcome:getComputedStyle(document.querySelector('.oi-welcome')).backgroundColor,field:getComputedStyle(document.querySelector('canvas[data-oi-stage="engine"]')).backgroundColor,fieldReady:document.querySelector('.oi-welcome').dataset.fieldReady,canvases:document.querySelectorAll('canvas').length}));
  await page.screenshot({path:out+`/startup-${theme}-field-ready.png`});
  results.push({theme,before,after});await context.close();
 }
 const context=await browser.newContext({viewport:{width:960,height:680},reducedMotion:'reduce'});
 await context.addInitScript(()=>{localStorage.setItem('oi-cradle.visuals.v1',JSON.stringify({enabled:false,welcomeEnabled:true,theme:'light'}));window.createdContexts=[];const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){const value=original.call(this,kind,...args);if(value)createdContexts.push(kind);return value;};});
 const page=await context.newPage(),requests=[];page.on('request',request=>{if(request.url().startsWith(url))requests.push(new URL(request.url()).pathname);});
 await page.goto(url,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.querySelector('.oi-workspace-mount'));
 const disabled=await page.evaluate(()=>({canvases:document.querySelectorAll('canvas').length,contexts:createdContexts,body:getComputedStyle(document.body).backgroundColor}));
 results.push({disabled:{...disabled,requests:[...new Set(requests)],heavyRequests:requests.filter(name=>/expressions-engine-|three-|engineSurface-|nativeCues-/.test(name))}});
 await context.close();
 writeFileSync(out+'/startup-readonly-audit.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results,null,2));
} finally {await browser.close();await new Promise(r=>server.close(r));}
