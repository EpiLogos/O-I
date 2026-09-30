/** Actual production GPU: last formation/pin slots and retained global modes.
 * Inputs are authored generic compositions, never personal constitutions. */
import assert from 'node:assert/strict';
import {build} from '../expressions-app/node_modules/esbuild/lib/main.js';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,isAbsolute} from 'node:path';
const output=process.argv[2];assert.ok(isAbsolute(output));await mkdir(output,{recursive:true});
await build({stdin:{resolveDir:resolve('.'),contents:`
import {ProductionAdapter} from './expressions-app/field-studies-journeys/src/production';
import {blankScene,entity,pin} from './expressions-app/field-studies-journeys/src/model';
import {defaultCamera} from './expressions-app/field-studies-journeys/src/camera';
import {NATIVE_BINDINGS,bindValue} from './expressions-app/field-studies-journeys/src/nativeParameters';
import {MAX_FORMATIONS,MAX_PINS} from './expressions-app/src/engine/fieldModel';
const check=(yes,message)=>{if(!yes)throw Error(message);};
const difference=(a,b)=>a.reduce((v,n,i)=>Math.max(v,Math.abs(n-b[i])),0);
window.measure=()=>{
 const scene=blankScene('Native capacity verification');
 const set=(s,path,value)=>{const b=NATIVE_BINDINGS.find(b=>b.path===path);check(b,'Missing native control '+path);bindValue(s,b.bind,value/b.factor);};
 for(const [key,value] of [['particleCount',2048],['fluid.turbulence',0],['fluid.vortexStrength',0],['fluid.thermalJitter',0],['fluid.dispersion',0],['fluid.gravityX',0],['fluid.gravityY',0],['fluid.gravityZ',0]])set(scene,key,value);
 Object.assign(scene.engine,{mediumEnabled:false,resonanceEnabled:false,morphEnabled:false,autoOscillate:false,relationalEnabled:false,pairwiseEnabled:false});
 scene.entities=Array.from({length:MAX_FORMATIONS},(_,i)=>{
  const e=entity('Formation '+i,'O',{x:(i%8-3.5)*.3,y:(Math.floor(i/8)-3.5)*.3,z:0});
  e.id='formation-'+i;e.size={x:.12,y:.12};e.force.strength=0;e.sequence.enabled=false;return e;
 });
 scene.entities.push(...Array.from({length:MAX_PINS},(_,i)=>{const e=pin({x:2,y:0,z:0});e.id='pin-'+i;e.force.strength=0;return e;}));
 const canvas=document.createElement('canvas');document.body.append(canvas);const engine=new ProductionAdapter(canvas);engine.resize(640,640,1);
 const frame={scene,simTime:0,delta:0,params:scene.field.params,camera:defaultCamera(),pointer:{active:false,world:{x:0,y:0,z:0}},selectedIds:[]};
 try{
  engine.render(frame);const checkpoint=engine.transportState();check(checkpoint,'Native transport exists');
  const run=change=>{
   engine.render(frame);engine.restoreTransport(checkpoint);engine.command({type:'reset-field'});engine.render(frame);
   const initial=engine.inspect(true),next=structuredClone(scene);change(next);
   for(let i=1;i<=24;i++)engine.render({...frame,scene:next,params:next.field.params,simTime:i/120,delta:1/120});
   return {initial,result:engine.inspect(true)};
  };
  const base=run(()=>{}),moved=run(s=>{s.entities[MAX_FORMATIONS-1].position.x+=.5;}),forced=run(s=>{s.entities.at(-1).force.strength=8;});
  check(base.result.connections.nodeFormations===MAX_FORMATIONS,'Full native formation budget reaches the engine');
  for(const trial of [moved,forced])check(difference(base.initial.positions,trial.initial.positions)===0,'Every trial starts from the exact same native reset');
  const lastStart=Math.floor(base.result.particleCount*(MAX_FORMATIONS-1)/MAX_FORMATIONS)*4;
  let dx=0,n=0;for(let i=lastStart;i<moved.result.velocities.length;i+=4){dx+=moved.result.velocities[i]-base.result.velocities[i];n++;}
  check(dx/n>1,'Last formation follows its own changed centre in the expected positive direction: '+JSON.stringify({dx,n,delta:dx/n,lastStart,particles:base.result.particleCount,tail:base.result.velocities.slice(-16),moved:moved.result.velocities.slice(-16),connections:base.result.connections}));
  check(difference(base.result.velocities.slice(0,lastStart),moved.result.velocities.slice(0,lastStart))<1e-5,'Moving only the last formation preserves all other uncoupled partitions');
  const lastPinEffect=difference(base.result.velocities,forced.result.velocities);check(lastPinEffect>1e-3,'Last pin must affect real GPU particles through the full force table');
  // Use fresh owners for independent global-mode trials: a particle reset is
  // not a claim to rewind resident complex envelopes.
  const resonance=frequency=>{const c=document.createElement('canvas'),e=new ProductionAdapter(c);e.resize(640,640,1);const s=structuredClone(scene);s.engine.resonanceEnabled=true;s.engine.resonatorMode='resonator';set(s,'cymatics.frequencyHz',frequency);set(s,'cymatics.dominance',1);set(s,'cymatics.agitation',0);try{e.render({...frame,scene:s,params:s.field.params});e.command({type:'reset-field'});for(let i=1;i<=24;i++)e.render({...frame,scene:s,params:s.field.params,delta:1/120,simTime:i/120});return e.inspect(true);}finally{e.dispose();}};
  const low=resonance(80),high=resonance(320),globalModeEffect=difference(low.velocities,high.velocities);
  check(globalModeEffect>1e-4,'Retained global resonator still consumes distinct physical frequencies: '+JSON.stringify({globalModeEffect,low:low.composition.cymatic,high:high.composition.cymatic}));
  const gl=canvas.getContext('webgl2'),debug=gl.getExtension('WEBGL_debug_renderer_info');
  check(gl.getError()===gl.NO_ERROR,'Actual graphics context must have no error');
  return {formations:MAX_FORMATIONS,pins:MAX_PINS,lastFormationVelocityDelta:dx/n,lastPinEffect,globalModeEffect,gpu:gl.getParameter(debug.UNMASKED_RENDERER_WEBGL),maxFragmentUniformVectors:gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS)};
 }finally{engine.dispose();canvas.remove();}
};`},bundle:true,format:'esm',platform:'browser',nodePaths:[resolve('expressions-app/node_modules')],outfile:join(output,'probe.js')});
const server=createServer(async(req,res)=>{res.setHeader('content-type',req.url==='/probe.js'?'text/javascript':'text/html');res.end(req.url==='/probe.js'?await readFile(join(output,'probe.js')):'<!doctype html><script type="module" src="/probe.js"></script>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const report={schema:'oi.simulation-capacity-gpu/v1',pass:false,errors:[]};
try{
 browser=await chromium.launch({headless:true,args:process.platform==='darwin'?['--use-gl=angle','--use-angle=metal','--enable-gpu']:[]});
 const page=await browser.newPage(),errors=report.errors;page.on('pageerror',e=>errors.push(String(e)));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>typeof window.measure==='function');
 Object.assign(report,await page.evaluate(()=>window.measure()));assert.deepEqual(errors,[]);report.pass=true;console.log(JSON.stringify(report));
}catch(error){report.failure=String(error);throw error;}
finally{await writeFile(join(output,'receipt.json'),JSON.stringify(report,null,2));await browser?.close();await new Promise(r=>server.close(r));}
