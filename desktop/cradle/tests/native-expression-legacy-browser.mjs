/** Exercise the retained React shell's actual controls and existing GPU image
 * export. This is not a QL/material/speaker or installed-desktop acceptance. */
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, rm, mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {createServer} from 'node:http';
import {build} from '../expressions-app/node_modules/esbuild/lib/main.js';
import {chromium} from 'playwright';

const temp = await mkdtemp(join(tmpdir(), 'w5-legacy-'));
const out = resolve(process.env.NATIVE_EXPRESSION_OUT ?? 'tests/artifacts/native-expression-legacy');
await mkdir(out, {recursive:true});
let browser, server;
const report = {schema:'oi.native-expression-legacy-browser/v1', pass:false, checks:[]};
try {
  await build({stdin:{resolveDir:resolve('expressions-app'), contents:`
import React, {useState, createRef} from 'react';
import {createRoot} from 'react-dom/client';
import {ColorSystemPanel} from './src/components/ColorSystemPanel';
import {ChakraPanel} from './src/components/ChakraPanel';
import {PointCloudComponent} from './src/components/PointCloudComponent';
import {DEFAULT_CONFIG} from './src/engine/PointCloudField';
import {createDefaultChakraConfig} from './src/engine/chakraSystem';
import {downloadSnapshot} from './src/engine/snapshot';
const ref=createRef();window.capture=downloadSnapshot;window.fieldRef=ref;
function Harness(){
 const [config,setConfig]=useState(()=>({...structuredClone(DEFAULT_CONFIG),particleCount:1024,spatialChakra:createDefaultChakraConfig()}));
 window.legacyConfig=config;
 return React.createElement(React.Fragment,null,
  React.createElement('div',{style:{width:256,height:192}},React.createElement(PointCloudComponent,{...config,ref,positioning:'relative',styleObj:{width:'256px',height:'192px'},onEngineReady:e=>window.legacyEngine=e})),
  React.createElement('button',{id:'capture',onClick:()=>downloadSnapshot(window.legacyEngine)},'Capture'),
  React.createElement(ColorSystemPanel,{config,setConfig,isLight:true}),
  React.createElement(ChakraPanel,{config,setConfig,isLight:true,timelineState:null,onJumpToNode:()=>{},onStepNode:()=>{}}));
}
const root=createRoot(document.getElementById('root'));root.render(React.createElement(Harness));window.unmount=()=>root.unmount();
`},bundle:true,platform:'browser',format:'esm',outfile:join(temp,'test.js')});
  server=createServer(async(req,res)=>{
    try {
      if(req.url==='/test.js'){res.setHeader('content-type','text/javascript');res.end(await readFile(join(temp,'test.js')));}
      else {res.setHeader('content-type','text/html');res.end('<!doctype html><div id="root"></div><script type="module" src="/test.js"></script>');}
    } catch(error){res.statusCode=500;res.end(String(error));}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  report.browser=browser.version();
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(()=>window.legacyEngine&&window.fieldRef.current);
  for(const [id,min,max,value,key] of [
    ['color-cycle-speed-slider',-4,4,-2.3,'cycleSpeed'],
    ['color-angle-slider',0,360,180,'angle'],
    ['color-hue-shift-slider',-2,2,-.5,'hueShiftSpeed'],
  ]){
    const slider=page.locator(`#${id}`);assert.equal(await slider.getAttribute('min'),String(min));assert.equal(await slider.getAttribute('max'),String(max));
    await slider.press('Home');
    for(let step=0;step<Math.round((value-min)/Number(await slider.getAttribute('step')));step++) await slider.press('ArrowRight');
    await page.waitForFunction(({key,value})=>window.legacyConfig.color[key]===value,{key,value});
  }
  report.checks.push('real colour controls preserve signed ranges and write requested values, not pixel-slider defaults');
  const glow=page.locator('#bg-glow-intensity-slider');await glow.press('Home');
  for(let step=0;step<15;step++) await glow.press('ArrowRight');
  await page.waitForFunction(()=>window.legacyConfig.backgroundGlowIntensity===.75);
  report.checks.push('existing ParamRow controls atmospheric glow at its declared scale');
  // The panel's frequency anchors remain physical readings, without fabricated
  // name/colour fields grafted into the numerical ResonanceAnchor interface.
  await page.getByRole('button',{name:'Cymatics',exact:true}).click();
  const anchor=page.locator('#btn-resonator-station-0');
  assert.match(await anchor.getAttribute('title'),/^Resonance 1 · \d+ Hz · m=\d+ n=\d+$/);
  await anchor.click();
  assert.ok(await page.evaluate(()=>Number.isFinite(window.legacyConfig.spatialChakra.cymatics.frequencyHz)));
  assert.match(await page.locator('#btn-cymatics-snap-0').innerText(),/Resonance 1/);
  report.checks.push('physical resonance anchors render usable labels and their existing frequency selection');
  const refResult=await page.evaluate(()=>{
    const e=window.legacyEngine,r=window.fieldRef.current,before=e.inspectState().seeds;
    const id=e.config.entities[0].id;r.setActiveEntity(id);const active=e.getActiveEntity();
    const centre=r.getEntityCentre(id);r.resetField();return {id,active,centre,before,after:e.inspectState().seeds};
  });
  assert.equal(refResult.id,refResult.active);assert.ok(refResult.centre);assert.equal(refResult.after,refResult.before+1);
  report.checks.push('declared imperative operations delegate to the same resident engine');
  const downloaded=page.waitForEvent('download');
  const capture=await page.evaluate(async()=>{
    const e=window.legacyEngine,before=e.inspectState(true);const pending=window.capture(e);
    const after=e.inspectState(true);await pending;return {before,after,width:e.canvas.width,height:e.canvas.height};
  });
  assert.deepEqual(capture.after,capture.before,'image capture must not step, reseed or mutate GPU state');
  const download=await downloaded;assert.equal(download.suggestedFilename(),'expression.png');
  assert.equal(await download.failure(),null);const bytes=await readFile(await download.path());
  assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.equal(bytes.readUInt32BE(16),capture.width);assert.equal(bytes.readUInt32BE(20),capture.height);
  report.checks.push('real PNG export has correct dimensions and leaves the GPU state unchanged');
  const failures=await page.evaluate(async()=>{
    const messages=[];
    for(const renderImage of [()=>{throw new Error('capture-budget-refused');},()=>({toBlob:cb=>cb(null)})]){
      try{await window.capture({canvas:{width:1,height:1},renderImage});messages.push('incorrectly-passed');}
      catch(error){messages.push(error.message);}
    }return messages;
  });
  assert.equal(failures[0],'capture-budget-refused');assert.match(failures[1],/could not encode/);
  report.checks.push('capture-budget and PNG encoder refusals remain errors, never a success notification');
  await page.evaluate(()=>window.unmount());assert.deepEqual(errors,[]);report.pass=true;
  console.log(JSON.stringify(report,null,2));
}catch(error){report.failure=String(error);throw error;}
finally{
  await writeFile(join(out,'legacy-browser.json'),JSON.stringify(report,null,2));
  await browser?.close();if(server)await new Promise(r=>server.close(r));await rm(temp,{recursive:true,force:true});
}
