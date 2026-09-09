import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
import {writeFile} from 'node:fs/promises';
const root=fileURLToPath(new URL('../',import.meta.url));
const server=await createServer({root,configFile:false,esbuild:{jsx:'automatic'},define:{__CRADLE_WALK__:'false'},server:{host:'127.0.0.1',port:0},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),checks=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));
const check=(name,result)=>{checks.push({name,pass:!!result});assert.ok(result,name);console.log('PASS '+name);};
try{
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/walk/expression-resize-integration.html`);
 await page.waitForFunction(()=>window.resizeIntegration?.inspect());
 await page.waitForTimeout(350);
 for(const [label,key]of [['Resize left region','ArrowRight'],['Resize right region','ArrowLeft'],['Resize canvas split','ArrowRight']]){
  const separator=page.getByRole('separator',{name:label,exact:true});await separator.focus();
  const before=await page.evaluate(()=>window.resizeIntegration.inspect().requests),oldValue=await separator.getAttribute('aria-valuenow');
  await separator.evaluate(element=>{
   window.resizeSamples=[];window.resizeSampling=true;window.bubbledResizeKeys=0;
   const listen=()=>window.bubbledResizeKeys++;document.addEventListener('keydown',listen,{once:true});
   window.clearResizeKeyListener=()=>document.removeEventListener('keydown',listen);
   const sample=()=>{const r=element.getBoundingClientRect();window.resizeSamples.push({x:r.x,y:r.y,requests:window.resizeIntegration.inspect().requests});if(window.resizeSampling)requestAnimationFrame(sample);};requestAnimationFrame(sample);
  });
  await separator.press(key);await page.waitForTimeout(500);
  const observation=await separator.evaluate(element=>{window.resizeSampling=false;window.clearResizeKeyListener();const r=element.getBoundingClientRect();return {samples:window.resizeSamples,final:{x:r.x,y:r.y},bubbled:window.bubbledResizeKeys};});
  check(`${label}: real React handler commits geometry`,await separator.getAttribute('aria-valuenow')!==oldValue);
  check(`${label}: exactly one accepted resize expression`,await page.evaluate(n=>window.resizeIntegration.inspect().requests===n+1,before));
  const first=observation.samples.find(sample=>sample.requests>before);
  check(`${label}: expression waits for committed geometry`,!!first&&Math.abs(first.x-observation.final.x)<.1&&Math.abs(first.y-observation.final.y)<.1);
  if(label==='Resize canvas split')check('split expression survives the actual handler stopPropagation',observation.bubbled===0);
  await page.waitForTimeout(750);
  check(`${label}: emitter drains`,await page.evaluate(()=>window.resizeIntegration.inspect().emitters===0));
 }
 const split=page.getByRole('separator',{name:'Resize canvas split',exact:true});
 await split.focus();await split.press('Home');await page.waitForTimeout(1100);
 const baseline=await page.evaluate(()=>window.resizeIntegration.inspect().requests),edge=await split.getAttribute('aria-valuenow');
 await split.press('Home');await page.waitForTimeout(1100);
 check('clamped split key commits no geometry and emits nothing',await split.getAttribute('aria-valuenow')===edge&&await page.evaluate(n=>window.resizeIntegration.inspect().requests===n,baseline));
 await split.press('Control+ArrowRight');await page.waitForTimeout(1100);
 check('unaccepted modifier key does not infer a resize',await split.getAttribute('aria-valuenow')===edge&&await page.evaluate(n=>window.resizeIntegration.inspect().requests===n,baseline));
 const left=page.getByRole('separator',{name:'Resize left region',exact:true});await left.focus();
 for(let i=0;i<5;i++)await left.press('ArrowLeft');await page.waitForTimeout(1300);
 const min=await left.getAttribute('aria-valuenow'),atMin=await page.evaluate(()=>window.resizeIntegration.inspect().requests);
 await left.press('ArrowLeft');await page.waitForTimeout(1100);
 check('clamped sidebar key emits nothing',min==='200'&&await left.getAttribute('aria-valuenow')===min&&await page.evaluate(n=>window.resizeIntegration.inspect().requests===n,atMin));
 await page.emulateMedia({reducedMotion:'reduce'});
 const beforeReduced=await page.evaluate(()=>window.resizeIntegration.inspect().requests);
 await left.press('ArrowRight');await page.waitForTimeout(350);
 check('reduced motion keeps real keyboard resizing without expression',await left.getAttribute('aria-valuenow')!==min&&await page.evaluate(n=>{const s=window.resizeIntegration.inspect();return s.requests===n&&s.emitters===0&&!s.scheduled;},beforeReduced));
 check('no React/browser errors' ,errors.length===0);
}finally{await writeFile('/tmp/oi-expression-resize-integration.json',JSON.stringify({checks,errors},null,2));await browser.close();await server.close();}
