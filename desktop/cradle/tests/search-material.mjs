/** Compositor diagnosis over the production SearchOverlay and its actual
 * material. A synthetic stripe witness is deliberately labelled test input.
 * Unlike computedStyle, screenshot pixels establish whether blur was painted.
 * This is controlled renderer evidence, not an installed suite/human walk. */
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {chromium, webkit} from 'playwright';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=resolve(root,'tests/artifacts/material');mkdirSync(out,{recursive:true});
const receipt={grade:'D',platform:process.platform,scope:'production component screenshot compositor diagnosis; synthetic stripe witness, not installed or human evidence',results:[]};
const server=await createServer({root,configFile:false,plugins:[react()],define:{__CRADLE_WALK__:'false'},server:{host:'127.0.0.1',port:1438,strictPort:true,fs:{allow:[root,resolve(root,'../../packages/oi-design-system')]}}});
await server.listen();
try {
  for(const [name,engine] of Object.entries({chromium,webkit})) {
    const browser=await engine.launch({headless:true});
    const page=await browser.newPage({viewport:{width:1280,height:820}});
    try {
      await page.route('**/__search_fixture/**',async route=>{
        if(route.request().method()!=='POST')return route.fulfill({json:{ok:true,receipts:[]}});
        const op=route.request().postDataJSON();
        if(op.op!=='knowledge')return route.fulfill({json:{ok:true,outcome:{result:'state',snapshot:{focus:{},surfaces:{},buffers:{}},receipts:[]}}});
        const data=op.request.action==='search'?{hits:[0,1].map(i=>({resource:`wiki/fixture-${i}`,label:`Source ${i}`,kind:'wiki',snippet:'Controlled source material',address:{kind:'wiki',value:`wiki/fixture-${i}`}})),absences:[]}:{rows:[{reference:'wiki/owner-row',kind:'wiki-object',label:'Owner resource',owner:'ai-kit',provenance:['Controlled owner-shaped row'],actions:[]}],absences:[]};
        return route.fulfill({json:{ok:true,outcome:{result:'knowledge',data,receipts:[]}}});
      });
      await page.goto('http://127.0.0.1:1438/tests/search-fixture.html');
      await page.getByRole('textbox',{name:'Writing before search'}).focus();
      await page.keyboard.press('Control+k');
      const panel=page.getByRole('dialog',{name:'Search Central'});
      await panel.waitFor();
      await page.waitForFunction(()=>document.querySelector('.search-aperture ul')?.getAttribute('aria-busy')==='false');
      await page.waitForTimeout(400);
      await page.screenshot({path:resolve(out,`${name}-production.png`)});
      const witness=await page.evaluateHandle(()=>{
        const node=document.createElement('div');node.setAttribute('aria-hidden','true');
        node.style.cssText='position:fixed;inset:0;z-index:2147483646;pointer-events:none;background:repeating-linear-gradient(90deg,#000 0 8px,#fff 8px 16px)';
        document.body.appendChild(node);return node;
      });
      const hide=await page.addStyleTag({content:'.search-aperture > * {visibility:hidden !important}'});
      const box=await panel.boundingBox();
      const clip={x:Math.ceil(box.x+80),y:Math.ceil(box.y+80),width:128,height:32};
      const contrast=async()=>{
        const bytes=await page.screenshot({clip});
        return page.evaluate(async data=>{
          const image=new Image();image.src=`data:image/png;base64,${data}`;await image.decode();
          const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
          const context=canvas.getContext('2d');context.drawImage(image,0,0);
          const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
          const samples=[];for(let i=0;i<pixels.length;i+=4)samples.push((pixels[i]+pixels[i+1]+pixels[i+2])/3);
          samples.sort((a,b)=>a-b);
          return samples[Math.floor(samples.length*.95)]-samples[Math.floor(samples.length*.05)];
        },bytes.toString('base64'));
      };
      const variants={
        production:'/* Unmodified production material. */',
        no_animation:'.search-aperture.search-glass {animation:none;transform:none}',
        promoted:'.search-aperture.search-glass {animation:none;transform:translateZ(0)}',
        transparent_scrim:'.search-aperture.search-glass::backdrop {background:transparent}',
        no_scrim:'.search-aperture.search-glass::backdrop {display:none}',
        pseudo_plane:'.search-aperture.search-glass {animation:none;background:transparent;backdrop-filter:none;-webkit-backdrop-filter:none}.search-aperture.search-glass::before {content:"";position:absolute;inset:0;pointer-events:none;border-radius:inherit;background:var(--oi-search-glass);backdrop-filter:blur(var(--oi-search-blur));-webkit-backdrop-filter:blur(var(--oi-search-blur))}',
        no_blur:'.search-aperture.search-glass {backdrop-filter:none !important;-webkit-backdrop-filter:none !important;animation:none}',
      };
      const result={browser:name,version:browser.version(),contrast:{}};
      for(const [variant,content] of Object.entries(variants)) {
        const style=await page.addStyleTag({content});
        await page.waitForTimeout(150);
        result.contrast[variant]=await contrast();
        await page.screenshot({path:resolve(out,`${name}-${variant}-witness.png`)});
        await style.evaluate(node=>node.remove());
      }
      await hide.evaluate(node=>node.remove());await witness.evaluate(node=>node.remove());
      receipt.results.push(result);console.log(JSON.stringify(result));
    } finally {await browser.close();}
  }
} finally {
  writeFileSync(resolve(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  await server.close();
}
