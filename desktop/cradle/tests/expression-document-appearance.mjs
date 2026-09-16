import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
import {renderedBounds} from '../walk/knowledge-projection-geometry.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const server=await createServer({root,appType:'custom',server:{host:'127.0.0.1',port:0},logLevel:'error'});
server.middlewares.use('/document-appearance',(_req,res)=>{
 res.setHeader('content-type','text/html');
 res.end('<body class="oi-desktop" style="margin:0"><link rel="stylesheet" href="/node_modules/@epilogos/oi-design-system/tokens.css"><div id="host" style="position:relative;width:600px;height:440px;background:var(--oi-canvas-ground)"></div><button id="focus">Keep focus</button></body>');
});
await server.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[],results=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/document-appearance`);
 await page.evaluate(async()=>{
  const {EngineSurface}=await import('/src/stage/engineSurface.ts');
  const {expressionConfig}=await import('/src/expression/engineProjection.ts');
  const ref='expression:appearance',scene_ref=`${ref}:scene:main`,entity_ref=`${ref}:entity:circle`;
  window.sourceDocument={schema:'oi.expression/v1',expression_ref:ref,revision:1,title:'Circle',selection:{scene_ref,entity_ref},
    scenes:[{scene_ref,revision:1,title:'Main',entity_refs:[entity_ref]}],
    entities:{[entity_ref]:{entity_ref,revision:1,title:'Circle',subject:null,parameters:{glyph:{value:'○',automation:null}}}},
    relations:{},provenance:[],representations:[],refinements:[]};
  window.originalDocument=JSON.stringify(window.sourceDocument);
  window.originalConfig=expressionConfig(window.sourceDocument);
  window.failures=[];
  window.surface=EngineSurface.forWindow(error=>window.failures.push(error));
  surface.presentConfig(ref,originalConfig,scene_ref,[entity_ref],'host');
  surface.setContainer(ref,document.getElementById('host'));
  window.originalCanvas=surface.canvas;
  window.originalContext=surface.canvas.getContext('webgl2');
 });
 await page.waitForFunction(()=>window.surface.telemetry()?.simTime>.8,null,{timeout:20000});
 await page.evaluate(()=>{surface.setPaused(true);window.originalSeeds=JSON.stringify(surface.adapter.engine.inspectState().seeds);document.getElementById('focus').focus();});
 for(const theme of ['light','dark','light']){
  await page.evaluate(theme=>{document.body.dataset.theme=theme;},theme);
  await page.waitForFunction(()=>surface.adapter.engine.config.backgroundColor===getComputedStyle(document.body).getPropertyValue('--oi-canvas-ground').trim());
  const pixels=await renderedBounds(page,page.locator('#host'));
  assert.ok(pixels[theme==='dark'?'lightInkPixels':'darkInkPixels']>100,`${theme}: the rendered circle must contrast with the real host ground: ${JSON.stringify(pixels)}`);
  assert.ok(pixels.maxContrast>=3,`${theme}: visible glyph ink meets 3:1 graphical contrast`);
  results.push({theme,...pixels});
  const retained=await page.evaluate(()=>({
    sameCanvas:surface.canvas===originalCanvas,sameContext:surface.canvas.getContext('webgl2')===originalContext,
    focus:document.activeElement.id,scene:surface.active.scene.id,selection:surface.selectedIds,
    seedsUnchanged:JSON.stringify(surface.adapter.engine.inspectState().seeds)===originalSeeds,
    documentUnchanged:JSON.stringify(sourceDocument)===originalDocument,configUnchanged:JSON.stringify(surface.active.hostMaterial)===JSON.stringify(originalConfig),
    count:document.querySelectorAll('canvas[data-oi-stage="engine"]').length,scheduled:surface.isScheduled,
  }));
  assert.deepEqual(retained,{sameCanvas:true,sameContext:true,focus:'focus',scene:'expression:appearance:scene:main',selection:['expression:appearance:entity:circle'],seedsUnchanged:true,documentUnchanged:true,configUnchanged:true,count:1,scheduled:false});
 }
 // Native instrument configs retain their explicitly authored palette; the
 // opt-in belongs to the presentation and never enters the native config.
 await page.evaluate(()=>{
  surface.release('expression:appearance');
  surface.presentConfig('native:authored',originalConfig,'native:authored:scene');
  surface.setContainer('native:authored',document.getElementById('host'));
  surface.setPaused(false);
 });
 await page.waitForFunction(()=>surface.active.id==='native:authored'&&surface.adapter.engine.config.color?.primaryColor===originalConfig.color.primaryColor);
 await page.evaluate(()=>{surface.setPaused(true);window.nativePalette=JSON.stringify(surface.adapter.engine.config.color);window.nativeGround=surface.adapter.engine.config.backgroundColor;document.body.dataset.theme='dark';});
 await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>JSON.stringify(surface.adapter.engine.config.color)===nativePalette&&surface.adapter.engine.config.backgroundColor===nativeGround&&!surface.active.hostMaterial),true,'native-config palettes remain authored across a host theme switch');
 assert.deepEqual(await page.evaluate(()=>window.failures),[]);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({check:'Expression document appearance',rendered:results,nativePalette:'preserved',identityAndFocus:'preserved'},null,2));
}finally{await page.evaluate(()=>window.surface?.dispose()).catch(()=>{});await browser.close();await server.close();}
