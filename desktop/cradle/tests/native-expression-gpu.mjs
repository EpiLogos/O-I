/** Real GPU effect conformance; controlled input is confined to this test.
 * A deliberately disconnected target port must remove the measured effect.
 * No native numeric or glyph model is reconstructed here. */
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
import {build} from '../expressions-app/node_modules/esbuild/lib/main.js';
const out=resolve(process.env.NATIVE_EXPRESSION_OUT??'walk/artifacts/native-expression-gpu');await mkdir(out,{recursive:true});
const temp=await mkdtemp(join(tmpdir(),'native-gpu-effect-'));
await build({stdin:{resolveDir:resolve('.'),contents:`
import {ProductionAdapter} from './expressions-app/field-studies-journeys/src/production';
import {NativeProjection} from './expressions-app/field-studies-journeys/src/native-field/projection';
import {blankScene,entity} from './expressions-app/field-studies-journeys/src/model';
import {defaultCamera} from './expressions-app/field-studies-journeys/src/camera';
import {controlledFrame} from './tests/native-expression-fixture.mjs';
window.measure=async(targetX,disconnect)=>{
 const originalRandom=Math.random;let seed=246813579;
 Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;document.body.append(canvas);
 const engine=new ProductionAdapter(canvas);let projection;
 try{
  const scene=blankScene('Controlled GPU correspondence');scene.entities=[entity('Controlled body','O')];
  Object.assign(scene.field.params,{count:1024,turbulence:0,circulation:0,dispersion:0,thermalJitter:0,grain:0,recovery:4});
  const frame={scene,authoringRevision:1,simTime:0,delta:0,params:scene.field.params,camera:defaultCamera(),pointer:{active:false,world:{x:0,y:0,z:0}},selectedIds:[]};
  engine.resize(640,480,1);engine.render(frame);const initial=engine.inspect(true),topology=engine.retainedTopology();
  const native=controlledFrame();native.targets.forEach(t=>t.position=[targetX,0,0]);
  engine.setNativeDomain(true);const port=engine.retainedTargetPort();
  // The mutation cuts only the producer->GPU operation; all admission and
  // renderer code still runs, so metadata-only implementations fail the test.
  const targetPort=disconnect?{...port,setTargetTextures(){}}:port;
  const slots=Array.from({length:topology.slot_count},(_,i)=>i%2);
  projection=new NativeProjection(targetPort,native,{units_per_metre:400,slots_a:slots,slots_b:slots});
  for(let i=1;i<=24;i++)engine.render({...frame,delta:1/120,simTime:i/120});
  const result=engine.inspect(true);
  return {initial:initial.positions,positions:result.positions,velocities:result.velocities,seeds:result.seeds,initialSeeds:initial.seeds,steps:result.steps,particles:result.particleCount};
 }finally{projection?.dispose();engine.releaseRetainedField();engine.dispose();canvas.remove();Math.random=originalRandom;}
};`},bundle:true,format:'esm',platform:'browser',nodePaths:[resolve('expressions-app/node_modules')],outfile:join(temp,'test.js')});
const server=createServer(async(req,res)=>{if(req.url==='/test.js'){res.setHeader('content-type','text/javascript');res.end(await readFile(join(temp,'test.js')));}else{res.setHeader('content-type','text/html');res.end('<!doctype html><script type="module" src="/test.js"></script>');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;const report={schema:'oi.native-expression-gpu-effect/v1',standing:'controlled native target changes through actual production GPU; not native model/installed material proof',pass:false};
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>typeof window.measure==='function');
 const [left,right,cutLeft,cutRight]=await page.evaluate(async()=>[await window.measure(-.25,false),await window.measure(.25,false),await window.measure(-.25,true),await window.measure(.25,true)]);
 const difference=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
 assert.deepEqual(left.initial,right.initial,'same seeded resident starting state');
 assert.deepEqual(cutLeft.initial,cutRight.initial,'same disconnected starting state');
 for(const result of [left,right,cutLeft,cutRight]){assert.equal(result.seeds,result.initialSeeds);assert.ok(result.positions.every(Number.isFinite));assert.ok(result.velocities.every(Number.isFinite));}
 report.position_effect=difference(left.positions,right.positions);report.velocity_effect=difference(left.velocities,right.velocities);
 assert.ok(report.position_effect>1e-4,'producer change must change actual GPU positions');assert.ok(report.velocity_effect>1e-4,'producer change must change actual GPU velocities');
 assert.deepEqual(cutLeft.positions,cutRight.positions,'disconnecting target operation removes position effect');
 assert.deepEqual(cutLeft.velocities,cutRight.velocities,'disconnecting target operation removes velocity effect');
 report.particles=left.particles;report.steps=left.steps;report.browser=browser.version();report.disconnected_effect=0;report.pass=true;assert.deepEqual(errors,[]);console.log(JSON.stringify(report,null,2));
}catch(error){report.failure=String(error);throw error;}finally{await writeFile(join(out,'gpu-effect.json'),JSON.stringify(report,null,2));await browser?.close();await new Promise(r=>server.close(r));await rm(temp,{recursive:true,force:true});}
