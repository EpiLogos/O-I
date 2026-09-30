#!/usr/bin/env node
/** Verify the actual owner-served built application, not a reconstructed
 * header. No browser state injection or native document mutation. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'vite';
import {chromium} from 'playwright';
const [bridge,output]=process.argv.slice(2);
assert.match(bridge,/^http:\/\/127\.0\.0\.1:\d+$/);
assert.ok(output?.includes('/Control/agents/now/clearings/')&&output.includes('/T/'));
await mkdir(output,{recursive:true});
const server=await createServer({configFile:false,root:process.cwd(),cacheDir:path.join(output,'module-cache'),server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]}});
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
const readings=[],errors=[];
try{
 const {hostedAppUrl}=await server.ssrLoadModule('/src/expressions/hostedApp.ts');
 const url=await hostedAppUrl({kind:'bridge',url:bridge},'?mode=techne');
 const page=await browser.newPage({viewport:{width:1280,height:960}});
 page.on('pageerror',error=>errors.push(String(error)));
 await page.goto(url,{waitUntil:'domcontentloaded'});
 const trigger=page.locator('#app .header-actions > button').filter({hasText:/^Nara$/});
 await trigger.waitFor({state:'attached',timeout:90000});
 for(const width of [1280,640]){
  await page.setViewportSize({width,height:960});
  const visible=await trigger.isVisible();
  readings.push({width,visible,attached:await trigger.count(),saveVisible:await page.locator('#native-save').isVisible()});
  await page.screenshot({path:path.join(output,`entry-${width}.png`)});
  assert.equal(visible,true,`Nara must remain reachable in the actual ${width}px application masthead`);
  await trigger.click();
  await page.getByRole('region',{name:'Nara Expression instrument'}).waitFor({state:'visible'});
  assert.equal(await trigger.getAttribute('aria-expanded'),'true');
  await page.getByRole('button',{name:'Return to the Expression',exact:true}).click();
  assert.equal(await trigger.getAttribute('aria-expanded'),'false');
 }
 assert.deepEqual(errors,[]);
 await writeFile(path.join(output,'receipt.json'),JSON.stringify({schema:'oi.nara-built-entry-replay/v1',url,readings,errors,limits:['Actual native owner-served built app entry and responsive interaction; standalone material page, not a native WebView or dialogue proof']},null,2));
 process.stdout.write(JSON.stringify({ok:true,readings,output})+'\n');
}catch(error){await writeFile(path.join(output,'failure.json'),JSON.stringify({error:String(error),readings,errors},null,2));throw error;}
finally{await browser.close();await server.close();}
