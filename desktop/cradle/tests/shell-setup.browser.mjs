// W1 visual treatment of #406's actual PlanDrawer and typed C0 source.
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium,webkit} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),out=fileURLToPath(new URL('./artifacts/shell-setup/',import.meta.url));mkdirSync(out,{recursive:true});
const server=await createServer({root,appType:'custom',server:{host:'127.0.0.1',port:0},logLevel:'error'});
server.middlewares.use('/shell-setup',async(_,res)=>{res.setHeader('content-type','text/html');res.end(await server.transformIndexHtml('/shell-setup','<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body class="oi-desktop"><div id="root"></div><script type="module" src="/tests/shell-setup-page.tsx"></script></body></html>'));});
await server.listen();const url=`http://127.0.0.1:${server.httpServer.address().port}/shell-setup`;
const receipt={classification:'controlled C0 source, real PlanDrawer and full presentation tokens; no native writes',checks:[],failures:[],passed:false};
try{
 for(const [name,engine] of Object.entries({chromium,webkit})){
  const browser=await engine.launch({headless:true});
  try{for(const scheme of ['light','dark']){for(const width of [1000,430,360]){
   const page=await browser.newPage({viewport:{width,height:900},colorScheme:scheme});page.setDefaultTimeout(15000);
   try{
    await page.goto(url);if(scheme==='dark')await page.evaluate(()=>document.body.dataset.theme='dark');
    const dialog=page.getByRole('dialog',{name:'Plan and apply'});
    await dialog.locator('[data-config-apply]:not([disabled])').waitFor();
    const fits=async stage=>{
     await page.screenshot({path:`${out}/${name}-${scheme}-${width}-${stage}.png`});
     const b=await dialog.boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width+1,'drawer remains inside viewport');
     assert.ok(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'no clipped horizontal drawer content');
     const clipped=await dialog.locator('input,select,textarea,button').evaluateAll(ns=>ns.filter(n=>{const r=n.getBoundingClientRect(),d=n.closest('[role="dialog"]').getBoundingClientRect();return r.width>0&&(r.left<d.left-1||r.right>d.right+1);}).map(n=>n.outerHTML));assert.deepEqual(clipped,[],'all controls remain horizontally reachable');
     receipt.checks.push(`${name}/${scheme}/${width}/${stage}`);
    };
    await fits('review');assert.equal(await page.evaluate(()=>shellSetup.writes()),0);
    await dialog.getByRole('button',{name:'Back to settings',exact:true}).click();
    const input=dialog.getByRole('group',{name:'Default model',exact:true}).getByLabel('Desired value',{exact:true});await input.selectOption('opus');await fits('edit');
    await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await dialog.waitFor({state:'detached'});await page.getByRole('button',{name:'Open setup',exact:true}).click();await input.waitFor();assert.equal(await input.inputValue(),'opus','edited draft survives Cancel/reopen');
    await dialog.locator('[data-setup-plan]').click();await dialog.locator('[data-config-apply]:not([disabled])').waitFor();await dialog.locator('[data-config-apply]').click();await dialog.locator('[data-changeset-status]').waitFor();await page.waitForFunction(()=>document.querySelector('[data-config-drawer]')?.getAttribute('aria-busy')==='false');await fits('partial-result');assert.equal(await page.evaluate(()=>shellSetup.writes()),1,'visual work does not replay native apply');
   }catch(e){receipt.failures.push({name,scheme,width,error:String(e),stack:e.stack});}finally{await page.close();}
  }}}finally{await browser.close();}
 }
 assert.deepEqual(receipt.failures,[]);receipt.passed=true;
}finally{writeFileSync(out+'/receipt.json',JSON.stringify(receipt,null,2));await server.close();}
