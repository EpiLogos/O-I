/** Fresh QL/Kerykeion calculations -> retained force compiler -> actual GPU.
 * Run from cradle: node tests/nara-evidence-forces-native.mjs /absolute/ql /absolute/output
 * No captured readings or replacement force solver. Controlled people only.
 */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve, join, isAbsolute} from 'node:path';
import {chromium} from 'playwright';
import {build} from '../expressions-app/node_modules/esbuild/lib/main.js';

const [ql, output] = process.argv.slice(2);
assert.ok(ql && output && isAbsolute(ql) && isAbsolute(output), 'Explicit native binary and output paths required');
await mkdir(output, {recursive:true});
const profile = (name, date) => ({schema:'ql.nara-identity-profile/v1', person_ref:`controlled:force:${name}`,
  nara_ref:`controlled:nara:force:${name}`, name:`Controlled ${name}`, birth:{date,time:'12:30:00',precision:'exact',
  uncertainty_minutes:null,fold:null,place:{label:'London',latitude_degrees:51.5074,longitude_degrees:-0.1278,
  timezone:'Europe/London',source_ref:'controlled:entered-coordinate'}},jungian:null,gene_keys:null,human_design:null,quintessence:null});
const readings=[];
for (const p of [profile('One','1990-06-15'),profile('Two','2001-12-22')]) {
  const result=spawnSync(ql,['nara','calculate','-','--json'],{input:JSON.stringify(p),encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024});
  assert.equal(result.status,0,result.stderr || String(result.error));
  const reading=JSON.parse(result.stdout);
  assert.equal(reading.natal_composition?.presentation_partition?.available,true,'Native calculation must supply new partitions');
  readings.push(reading);
}
await writeFile(join(output,'native-readings.json'),JSON.stringify(readings,null,2));
const code=`
import * as THREE from 'three';
import {DEFAULT_CONFIG} from './expressions-app/src/engine/PointCloudField';
import {GPGPUSimulator} from './expressions-app/src/engine/GPGPUSimulator';
import {makeSemanticChakraEntities} from './expressions-app/src/engine/semantics/chakraPresets';
import {makeLink} from './expressions-app/src/engine/fieldModel';
import {resolveEntityPose} from './expressions-app/src/engine/entityPose';
import {compileEntityForceEmitters} from './expressions-app/src/engine/forceRuntime';
import {projectNaraEvidenceForces,NARA_EVIDENCE_FORCE_POLICY} from './expressions-app/src/engine/naraEvidenceProjection';
const require=(ok,label)=>{if(!ok)throw Error(label);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
window.measure=async(readings)=>{
 const entities=makeSemanticChakraEntities('yantra');
 // Real authored per-link force, resolved through the retained pose evaluator.
 const link=makeLink(entities[0].shape);link.state={forces:{mode:'vortex',strength:3.7,spin:-.6,radius:87}};
 entities[0].sequence.links=[link];
 const authored=JSON.stringify(entities),poses=entities.map(e=>resolveEntityPose(e,0,0,0,0));
 const base=compileEntityForceEmitters(entities,poses,[]);
 require(base[0].strength===3.7&&base[0].spin===-.6,'Compiler must use actual evaluated link forces');
 const bindings=entities.map((e,ordinal)=>({ordinal,entityId:e.id}));
 const select=(partition)=>({policy:NARA_EVIDENCE_FORCE_POLICY,channel:partition.channel,partition,bindings});
 const direct=readings.map(r=>r.natal_composition.presentation_partition);
 const decan=readings.map(r=>r.natal_composition.decanic_channel.presentation_partition);
 const compiled=direct.map(p=>projectNaraEvidenceForces(base,select(p)));
 for(let i=0;i<2;i++)for(const emitter of compiled[i]){
  const original=base.find(e=>e.id===emitter.id),ordinal=bindings.find(b=>b.entityId===emitter.sourceEntityId).ordinal;
  const factor=direct[i].centres.find(c=>c.ordinal===ordinal).mass_share_l1;
  require(emitter.strength===original.strength*factor&&emitter.spin===original.spin*factor,'Only native factor scales evaluated forces');
  require(same({...emitter,strength:original.strength,spin:original.spin},original),'Other emitter parameters must be preserved');
 }
 require(JSON.stringify(entities)===authored,'Authored entities must remain unchanged');
 require(projectNaraEvidenceForces(base,null)===base,'Disconnect must return original reference');
 require(!same(compiled[0],compiled[1]),'Two actual natal calculations must differ');
 let rejected=false;try{projectNaraEvidenceForces(base,{...select(direct[0]),channel:'decan-ruler-reception'});}catch{rejected=true;}
 require(rejected,'Channel mismatch must refuse');
 const broken=structuredClone(direct[0]);broken.centres[0].mass_share_l1+=.1;
 rejected=false;try{projectNaraEvidenceForces(base,select(broken));}catch{rejected=true;}
 require(rejected,'Altered share without original evidence must refuse');
 const zeroReading=decan.find(p=>p.centres.some(c=>c.mass_share_l1===0));
 require(zeroReading,'Actual decanic calculation must retain empty recipients');
 const projectedZero=projectNaraEvidenceForces(base,select(zeroReading));
 const zeroIds=zeroReading.centres.filter(c=>c.mass_share_l1===0).map(c=>bindings[c.ordinal].entityId);
 require(projectedZero.every(e=>!zeroIds.includes(e.sourceEntityId)),'Zero-share vortices must be omitted');
 const renderer=new THREE.WebGLRenderer({antialias:false});
 const config=structuredClone(DEFAULT_CONFIG);
 Object.assign(config.fluid,{turbulence:0,vortexStrength:0,returnSpeed:0,dispersion:0,thermalJitter:0,gravityX:0,gravityY:0,gravityZ:0});
 config.medium.enabled=true;config.relational.enabled=false;config.pairwise.enabled=false;config.toroidalMorph.enabled=false;
 const material=JSON.stringify(config);
 const probe=emitters=>{
  const simulator=new GPGPUSimulator(renderer,64);
  const seed=new Float32Array(64*4);
  for(let i=0;i<64;i++){seed[4*i]=(i%8-3.5)*35;seed[4*i+1]=(Math.floor(i/8)-3.5)*70;seed[4*i+2]=0;seed[4*i+3]=1;}
  const target=new THREE.DataTexture(seed,8,8,THREE.RGBAFormat,THREE.FloatType);target.needsUpdate=true;
  try{
   simulator.seedInitialState(seed);simulator.setTargetTextures(target,target,new THREE.Vector2());simulator.setCompositionPlane('vertical');
   simulator.setForceEmitters(emitters);
   for(let i=1;i<=24;i++)simulator.step(1/120,i/120,config,0,new THREE.Vector2(-99999,-99999),new THREE.Vector2());
   const positions=new Float32Array(256),velocities=new Float32Array(256);
   renderer.readRenderTargetPixels(simulator.currentPosTarget,0,0,8,8,positions);
   renderer.readRenderTargetPixels(simulator.currentVelTarget,0,0,8,8,velocities);
   return {positions:Array.from(positions),velocities:Array.from(velocities),seeds:simulator.seedGeneration,steps:simulator.stepCount};
  }finally{simulator.destroy();target.dispose();}
 };
 try{
  const a=probe(compiled[0]),b=probe(compiled[1]),original=probe(base),disconnected=probe(projectNaraEvidenceForces(base,null));
  const none=probe([]),zeroOnly=probe(projectNaraEvidenceForces(base.filter(e=>zeroIds.includes(e.sourceEntityId)),select(zeroReading)));
  require(same(original,disconnected),'Disconnect must restore original GPU behavior');
  require(same(none,zeroOnly),'Zero evidence must remove even fixed inward vortex force');
  require(JSON.stringify(config)===material,'Projection must preserve all medium parameters');
  return {a,b,original,disconnected,zeroOnly,none,checks:12,zeroIds,policy:NARA_EVIDENCE_FORCE_POLICY,
    medium:config.medium,renderer:renderer.getContext().getParameter(renderer.getContext().RENDERER)};
 }finally{renderer.dispose();}
};`;
await build({stdin:{resolveDir:resolve('.'),contents:code},bundle:true,format:'esm',platform:'browser',nodePaths:[resolve('expressions-app/node_modules')],outfile:join(output,'probe.js')});
const server=createServer(async(req,res)=>{res.setHeader('content-type',req.url==='/probe.js'?'text/javascript':'text/html');res.end(req.url==='/probe.js'?await readFile(join(output,'probe.js')):'<!doctype html><script type="module" src="/probe.js"></script>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
const report={schema:'oi.nara-evidence-force-native-verification/v1',pass:false,
  ql:{path:ql,sha256:createHash('sha256').update(await readFile(ql)).digest('hex')},
  standing:'Fresh native astronomical calculations, retained evaluated forces and actual WebGL simulation; same controlled simulation occasion, not installed whole-Personal acceptance'};
try{
 browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>typeof window.measure==='function');
 const result=await page.evaluate(readings=>window.measure(readings),readings);
 for(const run of [result.a,result.b,result.original,result.disconnected,result.zeroOnly,result.none]){
  assert.ok(run.positions.every(Number.isFinite)&&run.velocities.every(Number.isFinite));assert.equal(run.seeds,1);assert.equal(run.steps,24);
 }
 const difference=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
 report.position_difference=difference(result.a.positions,result.b.positions);
 report.velocity_difference=difference(result.a.velocities,result.b.velocities);
 assert.ok(report.position_difference>1e-5,'Native identity difference must reach actual GPU positions');
 assert.ok(report.velocity_difference>1e-5,'Native identity difference must reach actual GPU velocities');
 assert.deepEqual(errors,[]);Object.assign(report,{pass:true,checks:result.checks,zero_recipient_entities:result.zeroIds,policy:result.policy,medium:result.medium,browser:browser.version(),renderer:result.renderer});
 console.log(JSON.stringify(report,null,2));
}catch(error){report.failure=String(error);throw error;}
finally{await writeFile(join(output,'receipt.json'),JSON.stringify(report,null,2));await browser?.close();await new Promise(r=>server.close(r));}
