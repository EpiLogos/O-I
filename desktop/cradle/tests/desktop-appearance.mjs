// Real desktop startup and persisted preferences; no replacement UI or kernel.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('../',import.meta.url));
const artifacts=fileURLToPath(new URL('../walk/artifacts/ui-convergence/',import.meta.url));
mkdirSync(artifacts,{recursive:true});
const server=await createServer({root,server:{host:'127.0.0.1',port:0},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({headless:true});
const url=`http://127.0.0.1:${server.httpServer.address().port}`;
const results=[];
try {
 for(const [choice,system,raw] of [
   ['light','dark'],['dark','light'],['system','light'],['system','dark'],
   ['system','dark','{invalid'],['system','dark','null'],
 ]) {
  const context=await browser.newContext({colorScheme:system,viewport:{width:1280,height:820}});
  await context.addInitScript(({choice,raw})=>{
   if(!sessionStorage.getItem('appearance-seeded')) {
    localStorage.setItem('oi-cradle.visuals.v1',raw??JSON.stringify({theme:choice,enabled:false,welcomeEnabled:false}));
    localStorage.setItem('oi-shell-footer-pinned','true');
    sessionStorage.setItem('appearance-seeded','true');
   }
   sessionStorage.setItem('oi-cradle.welcome.v1','appearance-verification');
   const observer=new MutationObserver(()=>{
    if(document.getElementById('root')&&window.firstTheme===undefined){window.firstTheme=document.body.dataset.theme??'light';observer.disconnect();}
   });
   observer.observe(document,{childList:true,subtree:true});
  },{choice,raw});
  const page=await context.newPage();
  await page.goto(url);
  await page.locator('.desktop-shell').waitFor();
  const expected=choice==='system'?system:choice;
  const appearance=await page.evaluate(()=>({first:window.firstTheme,current:document.body.dataset.theme??'light',background:getComputedStyle(document.body).backgroundColor,oldFooter:localStorage.getItem('oi-shell-footer-pinned')}));
  results.push({choice,system,raw:raw??'valid preference',expected,...appearance});
  assert.equal(appearance.first,expected,`pre-paint theme must match ${raw??choice}/${system}`);
  assert.equal(appearance.current,expected);
  assert.equal(appearance.oldFooter,null,'legacy pin state is retired');
  if(!raw) {
   await page.mouse.move(600,350);
   await page.waitForFunction(()=>parseFloat(getComputedStyle(document.querySelector('.canvas-arrangement')).opacity)===0);
   const collapsed=await page.locator('.workspace-footer-edge').boundingBox();
   assert.ok(collapsed.height<=4,'collapsed footer only consumes its reveal edge');
   assert.equal(await page.locator('.canvas-arrangement').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
   await page.screenshot({path:`${artifacts}/workspace-${choice}-${system}.png`});
   await page.locator('.workspace-footer-edge').hover();
   await page.waitForFunction(()=>parseFloat(getComputedStyle(document.querySelector('.canvas-arrangement')).opacity)===1);
   await page.getByRole('button',{name:'Pin workspace footer',exact:true}).click();
   await page.getByRole('button',{name:'Toggle left region',exact:true}).click();
   assert.equal(await page.locator('.workspace-footer-edge').getAttribute('data-pinned'),'true');
   await page.reload();await page.locator('.desktop-shell').waitFor();
   assert.equal(await page.locator('.workspace-footer-edge').getAttribute('data-pinned'),'true','explicit new pin persists');
   await page.getByRole('button',{name:'Unpin workspace footer',exact:true}).click();
   await page.getByRole('button',{name:'Toggle left region',exact:true}).click();
   await page.mouse.move(600,350);
   await page.waitForFunction(()=>parseFloat(getComputedStyle(document.querySelector('.canvas-arrangement')).opacity)===0);
   // Traverse the actual tab order into the hidden footer: focus reveals it.
   for(let count=0;count<70;count++) {
    await page.keyboard.press('Tab');
    if(await page.evaluate(()=>!!document.activeElement.closest('.canvas-arrangement')))break;
   }
   assert.equal(await page.evaluate(()=>!!document.activeElement.closest('.canvas-arrangement')),true,'footer remains keyboard reachable');
   await page.waitForFunction(()=>parseFloat(getComputedStyle(document.querySelector('.canvas-arrangement')).opacity)===1);
   await page.screenshot({path:`${artifacts}/footer-keyboard-${expected}.png`});
   await page.getByRole('button',{name:'Toggle left region',exact:true}).click();
   await page.mouse.move(600,350);
   await page.emulateMedia({reducedMotion:'reduce'});
   for(const width of [1000,999,760,759,640,639]) {
    await page.setViewportSize({width,height:820});
    await page.mouse.move(width/2,350);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`no page overflow at ${width}`);
    assert.ok((await page.locator('.workspace-footer-edge').boundingBox()).height<=4,`unpinned edge stays collapsed at ${width}`);
   }
   await page.screenshot({path:`${artifacts}/workspace-narrow-${expected}.png`});
   await page.reload();await page.locator('.desktop-shell').waitFor();
   assert.equal(await page.locator('.workspace-footer-edge').getAttribute('data-pinned'),'false','unpin survives navigation and reload');
  }
  await context.close();
 }
 console.log('Desktop appearance: explicit/system light and dark, corrupt preferences, legacy footer migration, explicit pin/unpin, keyboard reveal, reduced motion and 1000/760/640 boundaries passed.');
} finally {
 writeFileSync(`${artifacts}/appearance.json`,JSON.stringify(results,null,2)+'\n');
 await browser.close();await server.close();
}
