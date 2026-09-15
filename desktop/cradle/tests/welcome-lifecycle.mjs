import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
import {renderedBounds} from '../walk/knowledge-projection-geometry.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
// Explicit port: Vite's port:0 resolves to its default 5173, where another
// application may be running. Never silently move onto another task's port.
const server=await createServer({root,appType:'custom',server:{host:'127.0.0.1',port:4386,strictPort:true},logLevel:'error'});
server.middlewares.use('/welcome-lifecycle',async(_req,res)=>{
 res.setHeader('content-type','text/html');
 res.end(await server.transformIndexHtml('/welcome-lifecycle','<body class="oi-desktop" style="margin:0"><div id="root" tabindex="-1"></div><script type="module" src="/tests/welcome-page.tsx"></script></body>'));
});
await server.listen();
const url=`http://127.0.0.1:${server.httpServer.address().port}/welcome-lifecycle`;
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
const results=[],errors=[];
const stageSummary=({frames,live,scheduled,playback,presentations})=>({frames,live,scheduled,playback,presentations});
const observeErrors=page=>page.on('pageerror',error=>errors.push(error.message));
const fieldPixels=async page=>{
 const box=await page.locator('canvas[data-oi-stage="engine"]').boundingBox();
 assert.ok(box&&box.width>0&&box.height>0&&box.y<page.viewportSize().height,'the production canvas occupies the visible viewport');
 // Exclude the DOM caption. These are pixels of the actual native mark.
 return renderedBounds(page,{screenshot:()=>page.screenshot({clip:{...box,height:Math.floor(box.height*.7)}})});
};
const appReady=page=>page.evaluate(()=>welcomeTest.setAppReady(true));
const fieldReady=page=>page.waitForSelector('.oi-welcome[data-field-ready="true"]',{timeout:30000});
const entered=page=>page.waitForFunction(()=>welcomeTest.entered===1,null,{timeout:30000});
try {
 for(const theme of ['light','dark']) {
  const context=await browser.newContext({viewport:{width:900,height:700}});
  await context.addInitScript(theme=>localStorage.setItem('oi-cradle.visuals.v1',JSON.stringify({enabled:true,welcomeEnabled:true,theme})),theme);
  const page=await context.newPage();observeErrors(page);
  let deliver;
  const delivery=new Promise(resolve=>{deliver=resolve;});
  // Delay the real module over the real browser network, without replacing
  // its bytes, to expose the allocated/importing/painted distinction.
  await page.route('**/src/stage/engineSurface.ts',async route=>{await delivery;await route.continue();});
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.welcomeTest?.kernel?.stateSettled);
  assert.equal(await page.locator('.oi-welcome-enter').isDisabled(),true,'Enter is unavailable before the field paints');
  assert.equal(await page.evaluate(()=>welcomeTest.fieldReadyEvents.length),0,'no readiness signal is fabricated during import');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>welcomeTest.entered),0,'keyboard input cannot skip first paint');
  assert.equal(await page.evaluate(()=>welcomeTest.leakedKeys.length),0,'opening keys do not reach underlying global shortcuts while loading');
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('oi-cradle.welcome.v1')),null);
  deliver();
  await fieldReady(page);
  assert.equal(await page.locator('.oi-welcome-enter').isDisabled(),true,'actual field readiness still waits for parent app composition');
  assert.equal(await page.evaluate(()=>welcomeTest.fieldReadyEvents.length),1,'StrictMode reports native first paint once');
  assert.ok(await page.evaluate(()=>welcomeTest.fieldReadyEvents[0].frames>0),'readiness follows actual native frames');
  await appReady(page);
  await page.getByRole('button',{name:'O:I is ready. Open the app.',exact:true}).waitFor();
  const pixels=await fieldPixels(page),lightOpening=theme==='dark';
  assert.deepEqual(pixels.background,lightOpening?[251,251,249]:[18,18,17],'opening uses the opposite canonical ground');
  assert.ok(pixels[lightOpening?'darkInkPixels':'lightInkPixels']>1000,'the native O:I mark has readable inverse ink, without counting the DOM caption');
  const layers=await page.evaluate(()=>{
   const canvas=document.querySelector('canvas[data-oi-stage="engine"]'),welcome=document.querySelector('.oi-welcome');
   window.heldCanvas=canvas;window.heldContext=canvas.getContext('webgl2');
   return {background:getComputedStyle(welcome).backgroundColor,controls:Number(getComputedStyle(welcome).zIndex),field:Number(getComputedStyle(canvas).zIndex),canvasCount:document.querySelectorAll('canvas[data-oi-stage="engine"]').length};
  });
  assert.equal(layers.background,'rgba(0, 0, 0, 0)','ready controls do not cover the native scene ground');
  assert.ok(layers.controls>layers.field,'the real labelled control remains above the opaque native canvas');
  assert.equal(layers.canvasCount,1);
  if(theme==='light') await page.keyboard.press('Enter');
  else await page.getByRole('button',{name:'O:I is ready. Open the app.',exact:true}).click();
  await page.locator('.oi-welcome[data-phase="entering"]').waitFor();
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('oi-cradle.welcome.v1')),null,'starting a sequence is not a completed opening');
  if(theme==='light') {
   // Browser suspension is real: no fabricated document.hidden or RAF
   // implementation. A wall timer must not skip the unrendered flight.
   const cdp=await context.newCDPSession(page);
   await cdp.send('Page.setWebLifecycleState',{state:'frozen'});
   await new Promise(resolve=>setTimeout(resolve,1800));
   await cdp.send('Page.setWebLifecycleState',{state:'active'});
   assert.equal(await page.locator('.oi-welcome').getAttribute('data-phase'),'entering','an unrendered suspended interval cannot finish the opening');
   await cdp.detach();
  }
  await entered(page);
  const completion=await page.evaluate(()=>({
   stage:welcomeTest.completedStage,identity:document.querySelector('canvas[data-oi-stage="engine"]')===heldCanvas&&heldCanvas.getContext('webgl2')===heldContext,
   marker:sessionStorage.getItem('oi-cradle.welcome.v1'),theme:welcomeTest.visuals.get().theme,fieldEvents:welcomeTest.fieldReadyEvents.length,
  }));
  assert.equal(completion.identity,true,'opening through final release retains the same canvas and context');
  assert.equal(completion.marker,'1');assert.equal(completion.theme,theme,'the opening does not rewrite the saved app appearance');
  assert.equal(completion.stage.live,false);assert.equal(completion.stage.scheduled,false);
  assert.equal(completion.stage.presentations.length,0);
  assert.equal(completion.stage.playback.status,'completed');
  assert.ok(completion.stage.playback.elapsed>=completion.stage.playback.duration,'completion includes the successfully rendered tail');
  assert.equal(completion.fieldEvents,1);
  assert.equal(await page.evaluate(()=>welcomeTest.leakedKeys.length),0,'entry keys are owned by the opening');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>welcomeTest.leakedKeys.length),1,'the capture handler is removed when the app becomes interactive');
  const frames=await page.evaluate(()=>welcomeTest.stage.inspect().frames);
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>welcomeTest.stage.inspect().frames),frames,'released welcome performs no further simulation');
  results.push({theme,inverseMark:pixels,completion:{...completion,stage:stageSummary(completion.stage)}});
  await page.reload();
  await entered(page);
  assert.equal(await page.locator('.oi-welcome').count(),0,'the completed opening is skipped in the same session');
  assert.equal(await page.evaluate(()=>welcomeTest.fieldReadyEvents.length),1,'skipping still allows the real app to compose');
  await context.close();
 }
 // Reduced motion uses the real runtime final still, then releases. There is
 // no duration assertion: a slow real first draw is allowed to take its time.
 const reduced=await browser.newContext({viewport:{width:900,height:700},reducedMotion:'reduce'});
 const page=await reduced.newPage();observeErrors(page);
 await page.goto(url);await fieldReady(page);await appReady(page);
 await page.getByRole('button',{name:'O:I is ready. Open the app.',exact:true}).waitFor();
 const before=await page.evaluate(()=>welcomeTest.stage.inspect().frames);
 await page.keyboard.press('Escape');await entered(page);
 const reducedResult=await page.evaluate(()=>welcomeTest.completedStage);
 assert.ok(reducedResult.frames>before,'reduced motion paints the authored final still before entry');
 assert.equal(reducedResult.live,false);assert.equal(reducedResult.scheduled,false);
 assert.equal(reducedResult.playback.status,'completed');
 results.push({reducedMotion:stageSummary(reducedResult)});
 await reduced.close();
 assert.deepEqual(errors,[]);
 for(const disabled of [{enabled:false,welcomeEnabled:true},{enabled:true,welcomeEnabled:false}]) {
  const skipped=await browser.newContext();
  await skipped.addInitScript(preferences=>localStorage.setItem('oi-cradle.visuals.v1',JSON.stringify(preferences)),disabled);
  const skippedPage=await skipped.newPage();observeErrors(skippedPage);
  await skippedPage.goto(url);await entered(skippedPage);
  assert.equal(await skippedPage.locator('.oi-welcome').count(),0);
  assert.equal(await skippedPage.evaluate(()=>welcomeTest.fieldReadyEvents.length),1,'disabled opening still releases app composition once');
  assert.equal(await skippedPage.evaluate(()=>sessionStorage.getItem('oi-cradle.welcome.v1')),null,'disabling is not recorded as a human entry');
  if(!disabled.enabled) assert.equal(await skippedPage.locator('canvas[data-oi-stage="engine"]').count(),0,'Expression disabled creates no engine canvas');
  await skipped.close();
 }
 // Exercise genuine context creation failure. No mocked canvas or Stage API.
 const failedBrowser=await chromium.launch({headless:true,args:['--disable-webgl']});
 try {
  const failed=await failedBrowser.newPage({viewport:{width:900,height:700}});
  observeErrors(failed);await failed.goto(url);
  await failed.locator('.oi-welcome[data-field-error="true"]').waitFor({timeout:30000});
  assert.equal(await failed.evaluate(()=>welcomeTest.fieldReadyEvents.length),1,'failure lets the parent compose its usable app');
  await appReady(failed);
  const escape=failed.getByRole('button',{name:'Open O:I without the opening field.',exact:true});
  assert.equal(await escape.isEnabled(),true);
  assert.ok((await failed.getByRole('alert').innerText()).length>0,'the real failure is disclosed');
  await escape.click();await entered(failed);
  assert.equal(await failed.locator('.oi-welcome').count(),0,'engine failure leaves a working route into the app');
  results.push({webglUnavailable:'truthful failure with usable Continue'});
 }finally{await failedBrowser.close();}
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({check:'Welcome real component lifecycle',results},null,2));
}finally{await browser.close();await server.close();}
