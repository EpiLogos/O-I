import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
import {writeFile} from 'node:fs/promises';
const root=fileURLToPath(new URL('../',import.meta.url));
const server=await createServer({root,configFile:false,esbuild:{jsx:'automatic'},define:{__CRADLE_WALK__:'false'},server:{host:'127.0.0.1',port:0},logLevel:'error',
 // The stage seam transitively reaches the vendored expressions engine,
 // which lazy-imports three from the app's own install (the design-system
 // package has none of its own) — the same alias the production
 // vite.config.ts carries.
 resolve:{alias:{three:fileURLToPath(new URL('../node_modules/three',import.meta.url))}}});
await server.listen();
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),checks=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));
const check=(name,result)=>{checks.push({name,pass:!!result});assert.ok(result,name);console.log('PASS '+name);};
// Standing contract (owner ruling 2026-09-17): no motion expressions stand
// in the product. Real resizing — keyboard and pointer — commits real
// geometry through the React handlers, and the stage never claims an
// expression for it: the overlay records no requests, no emitters, and no
// scheduled work. When a deliberate motion grammar is adopted, this
// scenario is the place that pins it again.
try{
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/walk/expression-resize-integration.html`);
 await page.waitForFunction(()=>window.resizeIntegration?.inspect());
 await page.waitForTimeout(350);
 const quiet=async()=>page.evaluate(()=>{const s=window.resizeIntegration.inspect();return {requests:s.requests,emitters:s.emitters,entries:s.entries,scheduled:!!s.scheduled};});
 const before=await quiet();
 check('the held grammar starts with no overlay expressions',before.requests===0&&before.emitters===0&&before.entries===0);
 for(const [label,key]of [['Resize left region','ArrowRight'],['Resize right region','ArrowLeft'],['Resize canvas split','ArrowRight']]){
  const separator=page.getByRole('separator',{name:label,exact:true});await separator.focus();
  const oldValue=await separator.getAttribute('aria-valuenow');
  await separator.press(key);await page.waitForTimeout(400);
  check(`${label}: real React handler commits geometry`,await separator.getAttribute('aria-valuenow')!==oldValue);
  const during=await quiet();
  check(`${label}: resize claims no expression`,during.requests===0&&during.emitters===0&&during.entries===0);
 }
 const split=page.getByRole('separator',{name:'Resize canvas split',exact:true});
 await split.focus();await split.press('Home');await page.waitForTimeout(600);
 const edge=await split.getAttribute('aria-valuenow'),atEdge=await quiet();
 await split.press('Home');await page.waitForTimeout(600);
 check('clamped split key commits no geometry and claims nothing',await split.getAttribute('aria-valuenow')===edge&&await quiet().then(s=>s.requests===atEdge.requests));
 await split.press('Control+ArrowRight');await page.waitForTimeout(600);
 check('unaccepted modifier key does not infer a resize',await split.getAttribute('aria-valuenow')===edge);
 const left=page.getByRole('separator',{name:'Resize left region',exact:true});await left.focus();
 for(let i=0;i<5;i++)await left.press('ArrowLeft');await page.waitForTimeout(700);
 const min=await left.getAttribute('aria-valuenow');
 await left.press('ArrowLeft');await page.waitForTimeout(600);
 check('clamped sidebar key commits nothing',min==='200'&&await left.getAttribute('aria-valuenow')===min);
 await page.emulateMedia({reducedMotion:'reduce'});
 await left.press('ArrowRight');await page.waitForTimeout(400);
 check('reduced motion keeps real keyboard resizing without expression',await left.getAttribute('aria-valuenow')!==min&&await quiet().then(s=>s.requests===0&&s.emitters===0&&!s.scheduled));
 const after=await quiet();
 check('the held grammar ends with no overlay expressions and nothing scheduled',after.requests===0&&after.emitters===0&&after.entries===0&&!after.scheduled);
 check('no React/browser errors' ,errors.length===0);
}finally{await writeFile('/tmp/oi-expression-resize-integration.json',JSON.stringify({checks,errors},null,2));await browser.close();await server.close();}
