/** Production search material under controlled input. On macOS compare the
 * actual headed display with the browser snapshot: offscreen painting is not
 * necessarily the compositor. No installed-suite or human proof is claimed. */
import {mkdirSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {chromium, webkit} from 'playwright';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=resolve(root,'tests/artifacts/material');mkdirSync(out,{recursive:true});
const mac=process.platform==='darwin';
const receipt={grade:'D',platform:process.platform,headed:mac,scope:'production component + controlled stripe input; OS display and browser snapshots distinguished; not installed or human evidence',results:[]};
const server=await createServer({root,configFile:false,plugins:[react()],define:{__CRADLE_WALK__:'false'},server:{host:'127.0.0.1',port:1438,strictPort:true,fs:{allow:[root,resolve(root,'../../packages/oi-design-system')]}}});
await server.listen();
try {
  for(const [name,engine] of Object.entries({chromium,webkit})) {
    const browser=await engine.launch({headless:!mac});
    const page=await browser.newPage({viewport:{width:1000,height:700}});
    const result={browser:name,version:browser.version(),samples:[],displayErrors:[]};
    const display=async label=>{
      if(!mac)return;
      await page.bringToFront();await page.waitForTimeout(400);
      try {execFileSync('/usr/sbin/screencapture',['-x','-m',resolve(out,`${name}-${label}-display.png`)],{timeout:10000});}
      catch(error){result.displayErrors.push(String(error));}
    };
    try {
      await page.route('**/__search_fixture/**',async route=>{
        if(route.request().method()!=='POST')return route.fulfill({json:{ok:true,receipts:[]}});
        const op=route.request().postDataJSON();
        if(op.op!=='knowledge')return route.fulfill({json:{ok:true,outcome:{result:'state',snapshot:{focus:{},surfaces:{},buffers:{}},receipts:[]}}});
        const data=op.request.action==='search'?{hits:[0,1].map(i=>({resource:`wiki/fixture-${i}`,label:`Source ${i}`,kind:'wiki',snippet:'Controlled source material',address:{kind:'wiki',value:`wiki/fixture-${i}`}})),absences:[]}:{rows:[{reference:'wiki/owner-row',kind:'wiki-object',label:'Owner resource',owner:'ai-kit',provenance:['Controlled owner-shaped row'],actions:[]}],absences:[]};
        return route.fulfill({json:{ok:true,outcome:{result:'knowledge',data,receipts:[]}}});
      });
      for(const variant of ['production','no-blur','plain-control']) {
        // Fresh documents prevent a previous compositing layer from becoming
        // the next variant's evidence, including the negative control.
        await page.goto('http://127.0.0.1:1438/tests/search-fixture.html');
        await page.getByRole('textbox',{name:'Writing before search'}).focus();
        await page.keyboard.press('Control+k');
        const panel=page.getByRole('dialog',{name:'Search Central'});
        await panel.waitFor();
        await page.waitForFunction(()=>document.querySelector('.search-aperture ul')?.getAttribute('aria-busy')==='false');
        if(variant==='no-blur')await page.addStyleTag({content:'.search-aperture.search-glass{animation:none;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'});
        await page.waitForTimeout(400);
        await display(`${variant}-ui`);
        await page.screenshot({path:resolve(out,`${name}-${variant}-ui-snapshot.png`)});
        let box=await panel.boundingBox();
        await page.evaluate(({variant,box})=>{
          const witness=document.createElement('div');witness.setAttribute('aria-hidden','true');
          witness.style.cssText='position:fixed;inset:0;z-index:2147483646;pointer-events:none;background:repeating-linear-gradient(90deg,#000 0 8px,#fff 8px 16px)';
          document.body.appendChild(witness);
          if(variant==='plain-control') {
            document.querySelector('.search-aperture').close();
            const plane=document.createElement('div');plane.id='plain-glass-control';
            plane.style.cssText=`position:fixed;z-index:2147483647;left:${box.x}px;top:${box.y}px;width:${box.width}px;height:${box.height}px;background:rgba(245,246,240,.76);backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);border-radius:20px`;
            document.body.appendChild(plane);
          }
        },{variant,box});
        if(variant!=='plain-control')await page.addStyleTag({content:'.search-aperture>*{visibility:hidden!important}'});
        await page.waitForTimeout(400);
        await display(`${variant}-stripes`);
        const clip={x:Math.ceil(box.x+80),y:Math.ceil(box.y+80),width:128,height:32};
        const bytes=await page.screenshot({clip});
        const contrast=await page.evaluate(async data=>{
          const image=new Image();image.src=`data:image/png;base64,${data}`;await image.decode();
          const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
          const context=canvas.getContext('2d');context.drawImage(image,0,0);
          const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
          const values=[];for(let i=0;i<pixels.length;i+=4)values.push((pixels[i]+pixels[i+1]+pixels[i+2])/3);
          values.sort((a,b)=>a-b);return values[Math.floor(values.length*.95)]-values[Math.floor(values.length*.05)];
        },bytes.toString('base64'));
        await page.screenshot({path:resolve(out,`${name}-${variant}-stripes-snapshot.png`)});
        result.samples.push({variant,snapshotContrast:contrast});
      }
      receipt.results.push(result);console.log(JSON.stringify(result));
    } finally {await browser.close();}
  }
} finally {
  writeFileSync(resolve(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  await server.close();
}
