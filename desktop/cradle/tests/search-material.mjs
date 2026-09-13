/** Production search material, controlled input (D).
 * WebKit's offscreen snapshot omits the backdrop blur observed on the macOS
 * display. Gate that compositor using screencapture, not computedStyle or the
 * offscreen snapshot. Linux Chromium uses its browser screenshot. In both
 * cases a known stripe field and an explicitly unblurred negative control
 * prove actual rendering. No installed-suite or human acceptance is claimed. */
import assert from 'node:assert/strict';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {chromium, webkit} from 'playwright';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=resolve(root,'tests/artifacts/material');mkdirSync(out,{recursive:true});
const mac=process.platform==='darwin';
const name=mac?'webkit':'chromium';
const receipt={grade:'D',platform:process.platform,browser:name,headed:mac,capture:mac?'macOS screencapture':'Chromium screenshot',scope:'production component + controlled stripe input, not installed-suite or human evidence',samples:[],passed:false};
const server=await createServer({root,configFile:false,plugins:[react()],define:{__CRADLE_WALK__:'false'},server:{host:'127.0.0.1',port:1438,strictPort:true,fs:{allow:[root,resolve(root,'../../packages/oi-design-system')]}}});
await server.listen();
let browser;
try {
  browser=await (mac?webkit:chromium).launch({headless:!mac});
  receipt.version=browser.version();
  const page=await browser.newPage({viewport:{width:1000,height:700}});
  page.setDefaultTimeout(10000);
  const capture=async label=>{
    const file=resolve(out,`${name}-${label}-${mac?'display':'browser'}.png`);
    if(mac) {
      await page.bringToFront();await page.waitForTimeout(250);
      execFileSync('/usr/sbin/screencapture',['-x','-m',file],{timeout:10000});
      // Retain the distinct snapshot as evidence of the capture limitation.
      await page.screenshot({path:resolve(out,`${name}-${label}-snapshot.png`)});
    } else await page.screenshot({path:file});
    return readFileSync(file);
  };
  await page.route('**/__search_fixture/**',async route=>{
    if(route.request().method()!=='POST')return route.fulfill({json:{ok:true,receipts:[]}});
    const op=route.request().postDataJSON();
    if(op.op!=='knowledge')return route.fulfill({json:{ok:true,outcome:{result:'state',snapshot:{focus:{},surfaces:{},buffers:{}},receipts:[]}}});
    const data=op.request.action==='search'?{hits:[0,1].map(i=>({resource:`wiki/fixture-${i}`,label:`Source ${i}`,kind:'wiki',snippet:'Controlled source material',address:{kind:'wiki',value:`wiki/fixture-${i}`}})),absences:[]}:{rows:[{reference:'wiki/owner-row',kind:'wiki-object',label:'Owner resource',owner:'ai-kit',provenance:['Controlled owner-shaped row'],actions:[]}],absences:[]};
    return route.fulfill({json:{ok:true,outcome:{result:'knowledge',data,receipts:[]}}});
  });
  for(const variant of ['production','no-blur']) {
    // A fresh document prevents compositing state from the previous variant
    // from becoming the next one's evidence.
    await page.goto('http://127.0.0.1:1438/tests/search-fixture.html');
    await page.getByRole('textbox',{name:'Writing before search'}).focus();
    await page.keyboard.press('Control+k');
    const panel=page.getByRole('dialog',{name:'Search Central'});
    await panel.waitFor();
    await page.waitForFunction(()=>document.querySelector('.search-aperture ul')?.getAttribute('aria-busy')==='false');
    if(variant==='no-blur')await page.addStyleTag({content:'.search-aperture.search-glass{animation:none;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'});
    await page.waitForTimeout(400);
    const css=await panel.evaluate(el=>{const s=getComputedStyle(el);return {filter:s.backdropFilter||s.webkitBackdropFilter,background:s.backgroundColor};});
    assert.ok(css.background.startsWith('rgba('),'the witness must use translucent material, not an opaque false positive');
    assert.equal(css.filter.includes('28px'),variant==='production');
    await capture(`${variant}-ui`);
    await page.evaluate(()=>{
      const stripes=document.createElement('div');stripes.setAttribute('aria-hidden','true');
      stripes.style.cssText='position:fixed;inset:0;z-index:2147483646;pointer-events:none;background:repeating-linear-gradient(90deg,#000 0 8px,#fff 8px 16px)';
      document.body.appendChild(stripes);
      const marker=document.createElement('div');marker.setAttribute('aria-hidden','true');
      marker.style.cssText='position:absolute;left:80px;top:80px;width:8px;height:8px;background:rgb(255,0,239);pointer-events:none;visibility:visible!important';
      document.querySelector('.search-aperture').appendChild(marker);
    });
    await page.addStyleTag({content:'.search-aperture>*{visibility:hidden!important}'});
    await page.waitForTimeout(250);
    const bytes=await capture(`${variant}-stripes`);
    // Locate a known marker rather than guessing the OS title-bar offset or
    // display scale. The sampled rectangle contains only the panel material.
    const sample=await page.evaluate(async data=>{
      const image=new Image();image.src=`data:image/png;base64,${data}`;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
      const context=canvas.getContext('2d');context.drawImage(image,0,0);
      const {data:pixels}=context.getImageData(0,0,canvas.width,canvas.height);
      let x0=canvas.width,y0=canvas.height,x1=-1,y1=-1;
      for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++) {
        const i=(y*canvas.width+x)*4;
        if(pixels[i]>248&&pixels[i+1]<8&&pixels[i+2]>230&&pixels[i+2]<248){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
      }
      if(x1<0)throw new Error('The display did not capture the production panel marker');
      const scale=(x1-x0+1)/8;
      if(scale<.75||scale>3||Math.abs((y1-y0+1)/8-scale)>.25)throw new Error('Ambiguous display marker');
      const values=[];
      for(let y=Math.round(y0+16*scale);y<Math.round(y0+48*scale);y++)for(let x=Math.round(x0+16*scale);x<Math.round(x0+144*scale);x++) {
        const i=(y*canvas.width+x)*4;values.push((pixels[i]+pixels[i+1]+pixels[i+2])/3);
      }
      values.sort((a,b)=>a-b);
      return {contrast:values[Math.floor(values.length*.95)]-values[Math.floor(values.length*.05)],scale,marker:{x:x0,y:y0}};
    },bytes.toString('base64'));
    receipt.samples.push({variant,...sample});
  }
  const [glass,unblurred]=receipt.samples;
  assert.ok(unblurred.contrast>30,'the unblurred negative control must actually expose the background stripes');
  assert.ok(glass.contrast<unblurred.contrast*.2,'the production compositor must blur the background, not merely report CSS support');
  receipt.passed=true;
  console.log(JSON.stringify(receipt));
} catch(error) {
  receipt.failure=String(error);throw error;
} finally {
  writeFileSync(resolve(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  if(browser)await browser.close();
  await server.close();
}
