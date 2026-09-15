import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const server=await createServer({root,appType:'custom',server:{host:'127.0.0.1',port:0},logLevel:'error'});
server.middlewares.use('/stage-placement',(_req,res)=>{res.setHeader('content-type','text/html');res.end('<html><body style="margin:0"><div id="inline" style="position:relative;width:480px;height:320px"></div><div id="focus" style="position:relative;width:900px;height:640px"></div></body></html>');});
await server.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']}),page=await browser.newPage({viewport:{width:1000,height:800}});
try{
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/stage-placement`);
 await page.evaluate(async()=>{
  const {EngineSurface}=await import('/src/stage/engineSurface.ts');
  const {expressionConfig}=await import('/src/expression/engineProjection.ts');
  window.failures=[];window.stageSurface=EngineSurface.forWindow(error=>window.failures.push(error));
  const ref='expression:placement',scene_ref=`${ref}:scene:main`,entity_ref=`${ref}:entity:field`;
  const config=expressionConfig({selection:{scene_ref},scenes:[{scene_ref,entity_refs:[entity_ref]}],entities:{[entity_ref]:{entity_ref,title:'Field',parameters:{glyph:{value:'Field'}}}}});
  window.stageSurface.presentConfig(ref,config,scene_ref);
  window.originalCanvas=window.stageSurface.canvas;
  window.originalContext=window.originalCanvas.getContext('webgl2');
 });
 await page.waitForFunction(()=>window.stageSurface.canvas.width>0&&window.stageSurface.telemetry());
 const move=async id=>{
  await page.evaluate(id=>window.stageSurface.setContainer('expression:placement',id?document.getElementById(id):null),id);
  await page.waitForFunction(id=>{const canvas=window.stageSurface.canvas;return canvas.parentElement===(id?document.getElementById(id):document.body)&&canvas.clientWidth===(id?document.getElementById(id).clientWidth:1000);},id);
  return page.evaluate(()=>({sameCanvas:window.stageSurface.canvas===window.originalCanvas,sameContext:window.stageSurface.canvas.getContext('webgl2')===window.originalContext,count:document.querySelectorAll('canvas[data-oi-stage="engine"]').length}));
 };
 for(const id of ['inline','focus','inline',null]){
  const moved=await move(id);assert.equal(moved.sameCanvas,true);assert.equal(moved.sameContext,true);assert.equal(moved.count,1);
 }
 // Capture actual GPU material through the engine, not a screenshot or mocked image.
 await page.waitForFunction(()=>{try {return window.stageSurface.telemetry()?.simTime>0.8&&window.stageSurface.capture(320,240).width===320;}catch{return false;}});
 const capture=await page.evaluate(()=>{const canvas=window.stageSurface.capture(320,240);const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;const colours=new Set();let darkPixels=0;for(let i=0;i<pixels.length;i+=4){colours.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]},${pixels[i+3]}`);if(pixels[i]<100&&pixels[i+1]<100&&pixels[i+2]<100&&pixels[i+3]>128)darkPixels++;}return {width:canvas.width,height:canvas.height,colours:colours.size,darkPixels,data:canvas.toDataURL('image/png').length,errors:window.failures};});
 assert.equal(capture.width,320);assert.equal(capture.height,240);assert.ok(capture.data>200);assert.ok(capture.colours>1,'capture contains rendered material');assert.deepEqual(capture.errors,[]);
 assert.ok(capture.darkPixels>20,`Expression material must be visible as ink on the page: ${JSON.stringify(capture)}`);
 const refused=await page.evaluate(()=>{
  const results=[];
  for(const action of [()=>window.stageSurface.setContainer('expression:other',document.getElementById('inline')),()=>window.stageSurface.setContainer('expression:placement',document.createElement('div'))])try{action();results.push(false);}catch{results.push(true);}
  window.stageSurface.release('expression:placement');
  try{window.stageSurface.capture();results.push(false);}catch{results.push(true);}
  window.stageSurface.presentConfig('expression:placement',{glyph:'Return',particleCount:2048},'expression:placement:scene:main');
  return {results,sameCanvas:window.stageSurface.canvas===window.originalCanvas,sameContext:window.stageSurface.canvas.getContext('webgl2')===window.originalContext,errors:window.failures};
 });
 assert.deepEqual(refused.results,[true,true,true]);assert.equal(refused.sameCanvas,true);assert.equal(refused.sameContext,true);assert.deepEqual(refused.errors,[]);
 console.log('Expression stage: actual WebGL page/focus/return, capture, refusal and re-entry passed on one canvas/context.');
}finally{await page.evaluate(()=>window.stageSurface?.dispose()).catch(()=>{});await browser.close();await server.close();}
