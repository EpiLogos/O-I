/** Actual saved native identities and document -> production adapter -> real WebGL.
 * node tests/nara-localized-production-native.mjs <bridge-url> <native-document-json> <output> <ql-binary>
 * No replacement engine, synthetic bindings, or captured identity readings.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createServer as createViteServer} from 'vite';
import {randomUUID} from 'node:crypto';
import {closeControlledExpression} from './nara-native-cleanup.mjs';
import {resolve,join,isAbsolute} from 'node:path';
import {chromium} from 'playwright';
import {build} from '../expressions-app/node_modules/esbuild/lib/main.js';
const [bridge,documentPath,output,ql]=process.argv.slice(2);
assert.match(bridge??'',/^http:\/\/127\.0\.0\.1:\d+$/);assert.ok(isAbsolute(documentPath)&&isAbsolute(output)&&isAbsolute(ql));
await mkdir(output,{recursive:true});
const raw=JSON.parse(await readFile(documentPath,'utf8')),reference=(raw.document??raw).expression_ref;
const inspected=await fetch(bridge+'/op',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'expression',request:{operation:'inspect',expression_ref:reference}})}).then(r=>r.json());
assert.equal(inspected.ok,true);let document=inspected.outcome.data.document;
assert.equal(document.scenes.find(scene=>scene.scene_ref===document.selection.scene_ref).presentation.scene.entities.filter(entity=>entity.native?.chakraId).length,7,'The retained source must have exactly seven typed centre occurrences');
const exchanges=[];
async function owner(op,request){
 const response=await fetch(bridge+'/op',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op,request,...(['nara_current','m3_reception'].includes(op)?{project:''}:{})}),signal:AbortSignal.timeout(180000)});
 const result=await response.json();exchanges.push({op,request,response:result});await writeFile(join(output,'native-exchanges.json'),JSON.stringify(exchanges,null,2));assert.equal(result.ok,true,JSON.stringify(result));return result.outcome.data;
}
async function native(request){
 const response=await fetch(bridge+'/op',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'nara_identity',request}),signal:AbortSignal.timeout(180000)});
 const result=await response.json();exchanges.push({request,response:result});assert.equal(result.ok,true,JSON.stringify(result));return result.outcome.data;
}
const listed=await native({operation:'list'}),identities=[];
const profiles=listed.profiles.filter(p=>['controlled:native-replay:one','controlled:native-replay:two'].includes(p.person_ref));
assert.equal(profiles.length,2,'Two actually saved controlled identities required');
const moduleServer=await createViteServer({configFile:false,root:resolve('.'),cacheDir:join(output,'vite-cache'),server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,include:[]}});
let currents,bindings,later,forms,activityCurrents;
const ownedRef='expression:controlled-act-'+randomUUID();
const fork=await owner('expression',{operation:'fork',expression_ref:reference,expected_revision:document.revision,new_expression_ref:ownedRef,actor:'agent:nara-native-verification'});
const {adoptCoordinateExpression}=await moduleServer.ssrLoadModule('/src/nara/coordinateExpression.ts');
try{
const coordinate=await owner('nara_coordinate',{coordinate_ref:'#4.1',face:'bimba'});
document=await adoptCoordinateExpression(request=>owner('expression',request),coordinate,fork.document,fork.document.selection.entity_ref);
const sky_request={schema:'ql.sky-request/v1',epoch:'2026-09-27T12:00:00Z',timezone:'UTC',mode:'historical',perspective:'Apparent Geocentric',zodiac:'Tropical',ayanamsha:null,observer:null,max_age_seconds:300,backend_policy:'allow-moshier'};
currents=[];bindings=[];
for(const saved of profiles){
 const opened=await native({operation:'open',source_ref:saved.source_ref});
 const profile={...opened.reading.profile,person_ref:opened.reading.person_ref+':modal',nara_ref:opened.reading.nara_ref+':modal',encoding_policy:opened.reading.birthdate_encoding.policy,composition_policy:'draft-core-birthdate-decanic-40-60-v1'};
 assert.ok(profile.encoding_policy?.policy_ref,'The native reading must disclose its exact candidate encoding policy');
 const prior=listed.profiles.find(p=>p.person_ref===profile.person_ref);
 const savedProfile=await native({operation:'save',profile,source_ref:prior?.source_ref??null,expected_revision:prior?.revision??null});
 const binding={operation:'context',source_ref:savedProfile.source.source_ref,expected_revision:savedProfile.source.revision,person_ref:profile.person_ref,nara_ref:profile.nara_ref,expression_ref:ownedRef,role:'nara'};
 const current=await owner('nara_current',{operation:'pin',binding,sky_request});
 assert.equal(current.status,'available');assert.equal(current.reading.baseline_available,true);
 assert.equal(current.reading.transit.sky.request.epoch,sky_request.epoch);
 assert.deepEqual(current.reading.identity.profile.birth,opened.reading.profile.birth,'Choosing composition must preserve actual birth source');
 currents.push(current);bindings.push(binding);identities.push({source:savedProfile.source,reading:current.reading.identity});
}
assert.deepEqual(currents[0].reading.transit.q_transit,currents[1].reading.transit.q_transit);
assert.deepEqual(currents[0].reading.transit.sky.bodies,currents[1].reading.transit.sky.bodies,'Both native computations must receive the exact same dated astronomical event');
later=await owner('nara_current',{operation:'pin',binding:bindings[0],sky_request:{...sky_request,epoch:'2026-12-27T12:00:00Z'}});
assert.equal(later.status,'available');
// Recalculation issues a fresh native receipt. Its clock and content hash may
// differ; entered input and all computed natal determinants must not.
const natalDeterminants=value=>Array.isArray(value)?value.map(natalDeterminants):value&&typeof value==='object'
 ?Object.fromEntries(Object.entries(value).filter(([key])=>!['receipt_unix_ms','receipt_utc','snapshot_ref'].includes(key)).map(([key,item])=>[key,natalDeterminants(item)])):value;
assert.deepEqual(natalDeterminants(later.reading.identity),natalDeterminants(currents[0].reading.identity),'Changing the sky must preserve entered identity and every computed natal determinant');
const reopened=await native({operation:'open',source_ref:bindings[0].source_ref});
assert.equal(reopened.source.revision,bindings[0].expected_revision,'Pinning another sky must not write the saved identity');
assert.notDeepEqual(later.reading.transit.q_transit,currents[0].reading.transit.q_transit,'The changed dated sky must actually change its native determinant');
assert.notDeepEqual(later.reading.q_identity_transit,currents[0].reading.q_identity_transit);
forms=[];activityCurrents=[];
const openedM3=await owner('m3_reception',{operation:'open',binding:bindings[0],selections:{clock_steps:359,address:0,pose:0,aperture:0,matrix_axis:0,rna:false},activity_policy:'historical-personal-frame-sprite-v1'});
assert.equal(openedM3.state.form.hinge_geometry.schema,'ql.m3-hinge-presentation/v1');
forms.push(openedM3);
for(const address of [17,42]){
 const changed=await owner('m3_reception',{operation:'apply',binding:bindings[0],expected_generation:forms.at(-1).state.identity.profile_generation,operations:[{operation:'select-form',address}]});
 forms.push(changed);const current=await owner('nara_current',{operation:'read',binding:bindings[0]});activityCurrents.push(current);
 assert.equal(current.reading.activity_status,'available');assert.ok(current.reading.q_activity&&current.reading.q_composed);
 assert.deepEqual(current.reading.identity,later.reading.identity,'Activity must not change the pinned natal reading');
 assert.deepEqual(current.reading.transit,later.reading.transit,'Activity must not replace the pinned dated sky');
}
assert.notDeepEqual(activityCurrents[0].reading.q_composed,activityCurrents[1].reading.q_composed,'Successful native form commands must change actual admitted activity');
assert.equal((await native({operation:'open',source_ref:bindings[0].source_ref})).source.revision,bindings[0].expected_revision);

}catch(error){await closeControlledExpression(moduleServer,bridge,ownedRef,output,'Preserved failed native modal setup');await moduleServer.close();throw error;}

await writeFile(join(output,'native-exchanges.json'),JSON.stringify(exchanges,null,2));
const files=['expressions-app/field-studies-journeys/src/naraFormField.ts','expressions-app/src/engine/formationGeometryProjection.ts','expressions-app/src/engine/entityRuntime.ts','expressions-app/field-studies-journeys/src/naraEvidenceField.ts','expressions-app/field-studies-journeys/src/native-field/entitySound.ts','expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts','expressions-app/src/engine/naraEvidenceProjection.ts','expressions-app/field-studies-journeys/src/production.ts','expressions-app/src/engine/PointCloudField.ts','expressions-app/src/engine/GPGPUSimulator.ts','expressions-app/src/engine/LocalizedResonanceBank.ts','expressions-app/src/engine/shaders/simulationShaders.ts'];
const sources=Object.fromEntries(await Promise.all(files.map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])));
const code=`
import {kernelDocumentToJourney} from './expressions-app/field-studies-journeys/src/kernelDocumentBridge';
import {createEvidenceField} from './expressions-app/field-studies-journeys/src/naraEvidenceField';
import {naraFormGeometry} from './expressions-app/field-studies-journeys/src/naraFormField';
import {ProductionAdapter} from './expressions-app/field-studies-journeys/src/production';
import {defaultCamera} from './expressions-app/field-studies-journeys/src/camera';
import {toNativeConfig} from './expressions-app/field-studies-journeys/src/nativeBridge';
import {NATIVE_BINDINGS,bindValue} from './expressions-app/field-studies-journeys/src/nativeParameters';
const check=(v,m)=>{if(!v)throw Error(m);};
const diff=(a,b)=>a.reduce((n,v,i)=>Math.max(n,Math.abs(v-b[i])),0);
window.measure=async({document,identities,currents,later,forms,activityCurrents})=>{
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
 try{
  engine.render(frame);const transport=engine.transportState();check(transport,'Actual engine transport must exist');
  const gl=canvas.getContext('webgl2');check(gl,'Production WebGL context is required');
  const debug=gl.getExtension('WEBGL_debug_renderer_info');
  const gpu={renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),maxFragmentUniformVectors:gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),maxTextureUnits:gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)};
  const probe=(identity,current,connect)=>{
   const evidence=identity?createEvidenceField({identity,current,waves:true,channel:'direct-planetary-resonance'},view,scene.id):null;
   check(!connect||evidence?.project(view,scene.id),'Native centre/source admission must succeed');
   // An explicit disconnect releases envelopes before each independent trial.
   // Particle reset alone deliberately does not claim to rewind modal time.
   engine.render({...frame,localizedResonanceProjection:null});
   engine.restoreTransport(transport);engine.render({...frame,localizedResonanceProjection:connect?evidence?.resonance:null});
   engine.command({type:'reset-field'});const initial=engine.inspect(true);
   for(let i=0;i<24;i++)engine.render({...frame,delta:1/120,simTime:(i+1)/120,localizedResonanceProjection:connect?evidence?.resonance:null});
   const result=engine.inspect(true),image=canvas.toDataURL('image/png');
   return {initial,result,image};
  };
  const authored=probe(null,null,false),a=probe(identities[0],currents[0],true),b=probe(identities[1],currents[1],true),changedSky=probe(identities[0],later,true),disconnected=probe(identities[0],currents[0],false);
  for(const run of [a,b,changedSky,disconnected])check(diff(authored.initial.positions,run.initial.positions)===0&&diff(authored.initial.velocities,run.initial.velocities)===0,'Public reset must start from the same retained particle target');
  check(diff(authored.result.positions,disconnected.result.positions)===0&&diff(authored.result.velocities,disconnected.result.velocities)===0,'Disconnected consumer must exactly recover authored dynamics');
  const positionDifference=diff(a.result.positions,b.result.positions),velocityDifference=diff(a.result.velocities,b.result.velocities);
  check(positionDifference>1e-5&&velocityDifference>1e-5,'Identity difference must pass through ProductionAdapter and PointCloudField to real GPU state');
  check(diff(a.result.positions,disconnected.result.positions)>1e-5,'Removing actual frame consumer must remove the identity effect');
  check(a.result.localizedResonance.length===7&&b.result.localizedResonance.length===7,'All seven independent source-qualified drivers must reach the production engine');
  check(a.result.localizedResonance.every(row=>row.re.some(value=>Math.abs(value)>0)), 'Every admitted driver must develop actual resident modes');
  check(a.result.localizedResonance.every((row,i,rows)=>i===0||diff(row.re,rows[0].re)>1e-8),'Local modes must be independently determined, not copied from one state');
  check(disconnected.result.localizedResonance.length===0,'Disconnect must release every private resident mode');
  const skyPositionDifference=diff(a.result.positions,changedSky.result.positions),skyVelocityDifference=diff(a.result.velocities,changedSky.result.velocities);
  check(skyPositionDifference>1e-5&&skyVelocityDifference>1e-5,'Changing the native sky determinant must change actual GPU transport');
  check(JSON.stringify(a.result.localizedResonance)===JSON.stringify(changedSky.result.localizedResonance),'Changing field orientation must preserve the source-defined natal modal drivers and fixed centre positions');

  const activityA=probe(identities[0],activityCurrents[0],true),activityB=probe(identities[0],activityCurrents[1],true);
  const activityPositionDifference=diff(activityA.result.positions,activityB.result.positions),activityVelocityDifference=diff(activityA.result.velocities,activityB.result.velocities);
  check(activityPositionDifference>1e-6&&activityVelocityDifference>1e-6,'Changed native activity must reach actual GPU transport');
  const geometryProbe=reading=>{
   const geometry=reading?naraFormGeometry(reading,view,scene.id):null;
   engine.restoreTransport(transport);engine.render({...frame,formationGeometryProjection:geometry});
   engine.command({type:'reset-field'});engine.render({...frame,formationGeometryProjection:geometry});
   return engine.inspect(true);
  };
  const hingeA=geometryProbe(forms[0]),hingeB=geometryProbe(forms[1]),released=geometryProbe(null),authoredAgain=geometryProbe(null);
  const hingePositionDifference=diff(hingeA.positions,hingeB.positions);
  check(hingePositionDifference>1,'Native pair geometry must change the actual selected formation particle targets');
  check(diff(hingeB.positions,released.positions)>1,'Disconnecting native geometry must remove its target effect');
  check(diff(released.positions,authoredAgain.positions)===0,'Released native geometry must restore stable authored targets');
  const selectedEntity=view.bindings[scene.id].occurrences.find(o=>o.entity_ref===document.selection.entity_ref).view_entity_id;
  const partitions=hingeA.partitions;
  check(partitions.length===8&&partitions.some(p=>p.entityId===selectedEntity),'Actual GPU formation partitions must identify the selected centre and Earth');
  for(const partition of partitions.filter(p=>p.entityId!==selectedEntity))check(diff(hingeA.positions.slice(partition.start*4,partition.end*4),hingeB.positions.slice(partition.start*4,partition.end*4))===0,'Other formation targets must remain unchanged');
  check(JSON.stringify(document)===original&&JSON.stringify(scene)===material,'Private presentation must preserve native document and retained material');
  check(gl.getError()===gl.NO_ERROR,'The real graphics context must report no error');
  return {checks:23,activityPositionDifference,activityVelocityDifference,hingePositionDifference,gpu,positionDifference,velocityDifference,skyPositionDifference,skyVelocityDifference,localModes:a.result.localizedResonance,particleCount:a.result.particleCount,images:{a:a.image,b:b.image,changedSky:changedSky.image,disconnected:disconnected.image},medium:native.medium};
 }finally{engine.dispose();canvas.remove();}
};
const documentGlobal=window.document;
`;
await build({stdin:{resolveDir:resolve('.'),contents:code},bundle:true,format:'esm',platform:'browser',nodePaths:[resolve('expressions-app/node_modules')],outfile:join(output,'probe.js')});
const server=createServer(async(req,res)=>{res.setHeader('content-type',req.url==='/probe.js'?'text/javascript':'text/html');res.end(req.url==='/probe.js'?await readFile(join(output,'probe.js')):'<!doctype html><script type="module" src="/probe.js"></script>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;const report={schema:'oi.nara-localized-production-native-verification/v1',pass:false,sources,ql:{path:ql,sha256:createHash('sha256').update(await readFile(ql)).digest('hex')},limits:['Actual pinned identity-transit orientation and selected natal drive shares; retained time-averaged modal transport. No carrier phase, audio beat timing or canonical personal material coefficients claimed','Actual production adapter and GPU consumption; installed UI acceptance remains separate']};
try{
 browser=await chromium.launch({headless:true,args:process.platform==='darwin'?['--use-gl=angle','--use-angle=metal','--enable-gpu']:[]});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>typeof window.measure==='function');
 const result=await page.evaluate(input=>window.measure(input),{document,identities,currents,later,forms,activityCurrents});assert.deepEqual(errors,[]);
 for(const [key,value] of Object.entries(result.images))await writeFile(join(output,key+'.png'),Buffer.from(value.split(',')[1],'base64'));
 delete result.images;Object.assign(report,result,{pass:true,browser:browser.version()});console.log(JSON.stringify({pass:report.pass,checks:report.checks,gpu:report.gpu,positionDifference:report.positionDifference,velocityDifference:report.velocityDifference,skyPositionDifference:report.skyPositionDifference,skyVelocityDifference:report.skyVelocityDifference,receipt:join(output,'receipt.json')}));
}catch(error){report.failure=String(error);throw error;}
finally{await writeFile(join(output,'receipt.json'),JSON.stringify(report,null,2));await browser?.close();await new Promise(r=>server.close(r));await closeControlledExpression(moduleServer,bridge,ownedRef,output,report.pass?'Verified localized modal field':'Preserved failed localized modal verification');await moduleServer.close();}
