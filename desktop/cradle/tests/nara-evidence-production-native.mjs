/** Actual saved native identities and document -> production adapter -> real WebGL.
 * node tests/nara-evidence-production-native.mjs <bridge-url> <native-document-json> <output> <ql-binary>
 * No replacement sound engine, synthetic bindings, or captured identity readings.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,join,isAbsolute} from 'node:path';
import {chromium} from 'playwright';
import {build} from '../expressions-app/node_modules/esbuild/lib/main.js';
const [bridge,documentPath,output,ql]=process.argv.slice(2);
assert.match(bridge??'',/^http:\/\/127\.0\.0\.1:\d+$/);assert.ok(isAbsolute(documentPath)&&isAbsolute(output)&&isAbsolute(ql));
await mkdir(output,{recursive:true});
const raw=JSON.parse(await readFile(documentPath,'utf8')),reference=(raw.document??raw).expression_ref;
const inspected=await fetch(bridge+'/op',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'expression',request:{operation:'inspect',expression_ref:reference}})}).then(r=>r.json());
assert.equal(inspected.ok,true);const document=inspected.outcome.data.document;
assert.equal(document.scenes.find(scene=>scene.scene_ref===document.selection.scene_ref).presentation.scene.entities.filter(entity=>entity.native?.chakraId).length,7,'The retained source must have exactly seven typed centre occurrences');
const exchanges=[];
async function native(request){
 const response=await fetch(bridge+'/op',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'nara_identity',request}),signal:AbortSignal.timeout(180000)});
 const result=await response.json();exchanges.push({request,response:result});assert.equal(result.ok,true,JSON.stringify(result));return result.outcome.data;
}
const listed=await native({operation:'list'}),identities=[];
const profiles=listed.profiles.filter(p=>['controlled:native-replay:one','controlled:native-replay:two'].includes(p.person_ref));
assert.equal(profiles.length,2,'Two actually saved controlled identities required');
for(const saved of profiles){
 const opened=await native({operation:'open',source_ref:saved.source_ref});
 const process=spawnSync(ql,['nara','calculate','-','--json'],{input:JSON.stringify(opened.reading.profile),encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024});
 assert.equal(process.status,0,process.stderr||String(process.error));
 const calculated={reading:JSON.parse(process.stdout)};exchanges.push({native_ql:ql,profile:opened.reading.profile,calculated});
 assert.equal(calculated.reading.input_revision,opened.reading.input_revision);assert.equal(calculated.reading.natal_composition.presentation_partition.available,true);
 identities.push({source:opened.source,reading:calculated.reading});
}
await writeFile(join(output,'native-exchanges.json'),JSON.stringify(exchanges,null,2));
const files=['expressions-app/field-studies-journeys/src/naraEvidenceField.ts','expressions-app/field-studies-journeys/src/native-field/entitySound.ts','expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts','expressions-app/src/engine/naraEvidenceProjection.ts','expressions-app/field-studies-journeys/src/production.ts','expressions-app/src/engine/PointCloudField.ts','expressions-app/src/engine/GPGPUSimulator.ts'];
const sources=Object.fromEntries(await Promise.all(files.map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])));
const code=`
import {kernelDocumentToJourney} from './expressions-app/field-studies-journeys/src/kernelDocumentBridge';
import {createEvidenceField} from './expressions-app/field-studies-journeys/src/naraEvidenceField';
import {ProductionAdapter} from './expressions-app/field-studies-journeys/src/production';
import {defaultCamera} from './expressions-app/field-studies-journeys/src/camera';
import {toNativeConfig} from './expressions-app/field-studies-journeys/src/nativeBridge';
import {NATIVE_BINDINGS,bindValue} from './expressions-app/field-studies-journeys/src/nativeParameters';
const check=(v,m)=>{if(!v)throw Error(m);};
const diff=(a,b)=>a.reduce((n,v,i)=>Math.max(n,Math.abs(v-b[i])),0);
window.measure=async({document,identities})=>{
 const view=kernelDocumentToJourney(document),scene=view.journey.scenes.find(s=>s.id===view.startSceneId)??view.journey.scenes[0];
 const original=JSON.stringify(document),material=JSON.stringify(scene);
 // A controlled presentation uses the actual retained targets and emitter
 // forces. Turn off independent stochastic drivers and the stateful fluid for
 // exact A/B causal isolation; shared-fluid coupling has a separate GPU proof.
 const controlled=structuredClone(scene);
 for(const [path,value] of [['particleCount',2048],['fluid.turbulence',0],['fluid.thermalJitter',0],['fluid.vortexStrength',0],['fluid.gravityX',0],['fluid.gravityY',0],['fluid.gravityZ',0]]){
  const binding=NATIVE_BINDINGS.find(b=>b.path===path);check(binding,'Native parameter missing: '+path);bindValue(controlled,binding.bind,value/binding.factor);
 }
 Object.assign(controlled.engine,{mediumEnabled:false,resonanceEnabled:false,morphEnabled:false,autoOscillate:false,relationalEnabled:false,pairwiseEnabled:false});
 controlled.automation=[];for(const entity of controlled.entities)entity.sequence.enabled=false;
 const native=toNativeConfig(controlled);check(!native.medium.enabled&&!native.cymatics.enabled,'Stateful independent drivers must be off');
 const canvas=documentGlobal.createElement('canvas');documentGlobal.body.append(canvas);
 const engine=new ProductionAdapter(canvas);engine.resize(800,800,1);
 const frame={scene:controlled,simTime:0,delta:0,params:controlled.field.params,camera:defaultCamera(),pointer:{active:false,world:{x:0,y:0,z:0}},selectedIds:[]};
 let calls=0;
 try{
  engine.render(frame);const transport=engine.transportState();check(transport,'Actual engine transport must exist');
  const probe=(identity,connect)=>{
   const evidence=identity?createEvidenceField({identity,channel:'direct-planetary-resonance'},view,scene.id):null;
   const projector=evidence?.project(view,scene.id);
   const projected=connect&&projector?(emitters)=>{calls++;return projector(emitters);}:undefined;
   engine.restoreTransport(transport);engine.render({...frame,forceEmitterProjection:projected});
   engine.command({type:'reset-field'});const initial=engine.inspect(true);
   for(let i=0;i<24;i++)engine.render({...frame,delta:1/120,simTime:(i+1)/120,forceEmitterProjection:projected});
   const result=engine.inspect(true),image=canvas.toDataURL('image/png');
   return {initial,result,image};
  };
  const authored=probe(null,false),a=probe(identities[0],true),b=probe(identities[1],true),disconnected=probe(identities[0],false);
  for(const run of [a,b,disconnected])check(diff(authored.initial.positions,run.initial.positions)===0&&diff(authored.initial.velocities,run.initial.velocities)===0,'Public reset must start from the same retained particle target');
  check(diff(authored.result.positions,disconnected.result.positions)===0&&diff(authored.result.velocities,disconnected.result.velocities)===0,'Disconnected consumer must exactly recover authored dynamics');
  const positionDifference=diff(a.result.positions,b.result.positions),velocityDifference=diff(a.result.velocities,b.result.velocities);
  check(positionDifference>1e-5&&velocityDifference>1e-5,'Identity difference must pass through ProductionAdapter and PointCloudField to real GPU state');
  check(diff(a.result.positions,disconnected.result.positions)>1e-5,'Removing actual frame consumer must remove the identity effect');
  check(calls>=48,'Both frame consumers must be invoked by the production engine');
  check(JSON.stringify(document)===original&&JSON.stringify(scene)===material,'Private presentation must preserve native document and retained material');
  return {checks:8,positionDifference,velocityDifference,calls,particleCount:a.result.particleCount,images:{a:a.image,b:b.image,disconnected:disconnected.image},medium:native.medium};
 }finally{engine.dispose();canvas.remove();}
};
const documentGlobal=window.document;
`;
await build({stdin:{resolveDir:resolve('.'),contents:code},bundle:true,format:'esm',platform:'browser',nodePaths:[resolve('expressions-app/node_modules')],outfile:join(output,'probe.js')});
const server=createServer(async(req,res)=>{res.setHeader('content-type',req.url==='/probe.js'?'text/javascript':'text/html');res.end(req.url==='/probe.js'?await readFile(join(output,'probe.js')):'<!doctype html><script type="module" src="/probe.js"></script>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;const report={schema:'oi.nara-evidence-production-native-verification/v1',pass:false,sources,ql:{path:ql,sha256:createHash('sha256').update(await readFile(ql)).digest('hex')},limits:['Controlled force presentation with stateful fluid disabled for exact A/B comparison; shared-fluid coupling is separately tested','Actual production adapter and GPU consumption; installed UI acceptance remains separate']};
try{
 browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>typeof window.measure==='function');
 const result=await page.evaluate(input=>window.measure(input),{document,identities});assert.deepEqual(errors,[]);
 for(const [key,value] of Object.entries(result.images))await writeFile(join(output,key+'.png'),Buffer.from(value.split(',')[1],'base64'));
 delete result.images;Object.assign(report,result,{pass:true,browser:browser.version()});console.log(JSON.stringify(report));
}catch(error){report.failure=String(error);throw error;}
finally{await writeFile(join(output,'receipt.json'),JSON.stringify(report,null,2));await browser?.close();await new Promise(r=>server.close(r));}
