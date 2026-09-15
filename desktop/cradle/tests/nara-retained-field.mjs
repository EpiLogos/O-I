import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const packageRoot=fileURLToPath(new URL('../../../packages/oi-design-system/',import.meta.url));
const server=await createServer({root,appType:'custom',resolve:{alias:{'@epilogos/oi-design-system':packageRoot}},server:{host:'127.0.0.1',port:0},logLevel:'error'});
server.middlewares.use('/nara-retained',(_req,res)=>{res.setHeader('content-type','text/html');res.end('<div id="host" style="width:900px;height:700px"></div><script type="module" src="/tests/nara-retained-page.ts"></script>');});
await server.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']}),page=await browser.newPage({viewport:{width:900,height:700}});
try{
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/nara-retained`);
 await page.waitForFunction(()=>window.NaraRetainedTest);
 const result=await page.evaluate(async()=>{
  const {EngineSurface,blankScene,entity,nativeExport}=window.NaraRetainedTest;
  const scene=blankScene('Nara retained test');
  scene.entities=Array.from({length:8},(_,i)=>{const e=entity(i===7?'EarthBody':`Centre ${i+1}`,String(i+1),{x:0,y:i===7?-.94:-.66+i*.22,z:0});e.id=i===7?'earth-body':`centre-${i}`;e.share=1;e.scale=.8+i*.03;e.tint='#252720';e.tintWeight=0;return e;});
  const surface=EngineSurface.forElement(document.getElementById('host'),()=>{});
  surface.presentConfig('nara:test',nativeExport(scene).config,'nara:test:scene');
  const lease=surface.retainedLease('nara:test'),port=lease.retainedTargetPort();
  port.setTargetTextures(port.targetA,port.targetB,{x:0,y:0});
  const adapter=surface.adapter,engine=adapter.engine;
  lease.renderOnce();
  const capture=()=>({targets:[port.currentPosTarget,port.currentVelTarget,port.targetA,port.targetB],parts:engine.entities.getPartitions().map(p=>({id:p.entityId,start:p.start,end:p.end})),seeds:engine.inspectState().seeds,centres:engine.entities.uniforms.centers.map(v=>[v.x,v.y,v.z]),scales:Array.from(engine.entities.uniforms.depthScales),tints:engine.entities.uniforms.tints.map(v=>v.getHexString()),weights:Array.from(engine.entities.uniforms.tintWeights)});
  const before=capture();
  const request=(generation,delta=0)=>({schema:'oi.retained-presentation/v1',eventRef:'event:1',subjectRef:'subject:1',profileGeneration:4,personalGeneration:generation,entities:scene.entities.map((e,i)=>({id:e.id,x:(i===0?.2+delta/100:0),y:i===7?-.94:-.66+i*.22,z:0,scale:.9+i*.04+delta/100,tint:i===1?'#804020':'#252720',tintWeight:i===1?.72:0}))});
  lease.updatePresentation(request(10));lease.renderOnce();const first=capture();
  lease.updatePresentation(request(11,5));lease.renderOnce();const second=capture();
  let refused=false;try{const bad=request(10,20);lease.updatePresentation(bad);}catch{refused=true;}lease.renderOnce();const afterRefusal=capture();
  surface.release('nara:test');surface.presentConfig('nara:next',nativeExport(scene).config,'nara:next:scene');const nextLease=surface.retainedLease('nara:next'),nextPort=nextLease.retainedTargetPort();nextPort.setTargetTextures(nextPort.targetA,nextPort.targetB,{x:0,y:0});const newBefore=surface.adapter.engine.inspectState();let oldRefused=false;try{lease.updatePresentation(request(12));}catch{oldRefused=true;}const newAfter=surface.adapter.engine.inspectState();
  surface.dispose();
  return {before,first,second,afterRefusal,refused,oldRefused,newBefore,newAfter,targetSame:first.targets.every((v,i)=>v===before.targets[i])&&second.targets.every((v,i)=>v===before.targets[i]),partSame:JSON.stringify(before.parts)===JSON.stringify(first.parts)&&JSON.stringify(first.parts)===JSON.stringify(second.parts)};
 });
 assert.equal(result.refused,true);assert.equal(result.oldRefused,true);assert.deepEqual(result.newAfter,result.newBefore);assert.equal(result.targetSame,true);assert.equal(result.partSame,true);
 assert.equal(result.before.seeds,result.second.seeds);assert.notDeepEqual(result.before.scales,result.first.scales);assert.notDeepEqual(result.first.centres,result.second.centres);assert.notDeepEqual(result.before.tints,result.first.tints);
 assert.deepEqual(result.afterRefusal,result.second);
 assert.equal(new Set(result.first.centres.slice(0,7).map(JSON.stringify)).size,7);
 console.log('Nara retained field: 8 stable partitions, 7 distinct GPU loci, two receptions, no target replacement/reseed, atomic stale refusal.');
}finally{await browser.close();await server.close();}
