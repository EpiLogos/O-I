/** Real Chromium integration checks for package DOM/CSS; no backend fixtures. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
const require=createRequire(new URL('../../../desktop/cradle/package.json',import.meta.url));
const {chromium}=require('playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!path.startsWith(root.endsWith(sep)?root:root+sep))throw Error('outside root');const data=await readFile(path);res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.svg':'image/svg+xml'})[extname(path)]||'application/octet-stream');res.end(data);}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;let count=0;
const check=(name,result)=>{assert.ok(result,name);console.log('PASS '+name);count++;};
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1280,height:1000}});
 await page.goto(`http://127.0.0.1:${server.address().port}/examples/loading.html`);
 await page.getByRole('status').waitFor();
 check('status exposes the supplied truthful reference label',await page.getByRole('status').innerText().then(t=>t.includes('Pending status reference')));
 check('portable status allocates no renderer, masks or animation',await page.evaluate(()=>!document.querySelector('canvas,svg,.oi-loading-mark,.oi-point-clusters')&&document.getAnimations().length===0));
 for(const theme of ['light','dark']) {
  await page.selectOption('select',theme);
  const colors=await page.getByRole('status').evaluate(e=>({foreground:getComputedStyle(e).color,host:getComputedStyle(document.body).color}));
  check(`${theme}: status inherits the host ink`,colors.foreground===colors.host);
 }
 await page.getByRole('button',{name:'Update reference label'}).click();
 check('real update changes accessible status text',await page.getByRole('status').innerText().then(t=>t.includes('Updated reference text')));
 await page.emulateMedia({reducedMotion:'reduce',forcedColors:'active'});
 check('forced colors and reduced motion retain readable text with no animation',await page.getByRole('status').isVisible()&&await page.evaluate(()=>document.getAnimations().length===0));
 await page.emulateMedia({reducedMotion:'no-preference',forcedColors:'none'});
 check('component validates labels and renders strings safely',await page.evaluate(async()=>{const {createLoadingIndicator}=await import('/loading.mjs');let rejected=false;try{createLoadingIndicator({label:' '})}catch{rejected=true}const c=createLoadingIndicator({label:'<img src=x onerror=alert(1)>'});document.body.append(c.element);const safe=!c.element.querySelector('img')&&c.element.textContent.includes('<img');c.update({label:'Ready',active:false,detail:''});const updated=c.element.dataset.active==='false'&&c.element.querySelector('.oi-loading-detail').hidden;c.remove();return rejected&&safe&&updated&&!c.element.isConnected;}));
 await page.getByRole('button',{name:'Remove reference status'}).click();
 check('host removal ends status without taking focus',await page.getByRole('status').count()===0&&await page.locator('#remove').evaluate(e=>document.activeElement===e));
 await page.reload();await page.getByRole('status').waitFor();
 await page.setViewportSize({width:320,height:740});
 check('status fits a constrained viewport',await page.getByRole('status').evaluate(e=>e.getBoundingClientRect().left>=0&&e.getBoundingClientRect().right<=innerWidth));
 await page.addStyleTag({url:`http://127.0.0.1:${server.address().port}/desktop.css`});
 await page.evaluate(()=>{
  const disclosure=document.createElement('details');disclosure.className='oi-disclosure';
  disclosure.innerHTML='<summary>Source details</summary><p>Selected source provenance</p>';
  document.body.prepend(disclosure);
 });
 for(const forcedColors of ['none','active']) {
  await page.emulateMedia({forcedColors});
  await page.locator('.oi-disclosure > summary').focus();
  check(`disclosure has a visible keyboard outline (${forcedColors})`,await page.locator('.oi-disclosure > summary').evaluate(el=>{const s=getComputedStyle(el);return el.matches(':focus-visible')&&s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0;}));
  await page.keyboard.press('Enter');
  check(`keyboard opens disclosure (${forcedColors})`,await page.locator('.oi-disclosure').evaluate(el=>el.open));
  await page.keyboard.press('Enter');
 }
 console.log(`${count}/${count} browser checks passed`);
}finally{await browser?.close();await new Promise(r=>server.close(r));}
