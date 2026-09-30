/** Actual saved native identities and document -> production sound -> real Web Audio.
 * node tests/nara-evidence-sound-native.mjs <bridge-url> <native-document-json> <output> <ql-binary>
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
const raw=JSON.parse(await readFile(documentPath,'utf8')),document=raw.document??raw;
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
const files=['expressions-app/field-studies-journeys/src/naraEvidenceField.ts','expressions-app/field-studies-journeys/src/native-field/entitySound.ts','expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts','expressions-app/src/engine/naraEvidenceProjection.ts'];
const sources=Object.fromEntries(await Promise.all(files.map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])));
const code=`
import {kernelDocumentToJourney} from './expressions-app/field-studies-journeys/src/kernelDocumentBridge';
import {createEvidenceField} from './expressions-app/field-studies-journeys/src/naraEvidenceField';
import {EntitySoundBank,DEFAULT_ENTITY_SOUND} from './expressions-app/field-studies-journeys/src/native-field/entitySound';
const check=(v,m)=>{if(!v)throw Error(m);};
const rms=(s,a,b)=>Math.sqrt(s.slice(a,b).reduce((n,x)=>n+x*x,0)/(b-a));
const spectrum=(s,hz,r)=>{let re=0,im=0;for(let i=r*2;i<r*3;i++){const p=2*Math.PI*hz*i/r;re+=s[i]*Math.cos(p);im+=s[i]*Math.sin(p);}return 2*Math.hypot(re,im)/r;};
window.measure=async({document,identities})=>{
 const view=kernelDocumentToJourney(document),scene=view.journey.scenes.find(s=>s.id===view.startSceneId)??view.journey.scenes[0];
 const original=JSON.stringify(document),material=JSON.stringify(scene),rate=48000,frequencies=[148,184,145,221,141,210,126];
 const render=async(scene,disconnect)=>{
  const context=new OfflineAudioContext(2,rate*3,rate),bank=new EntitySoundBank(()=>context);
  const voices=bank.sync(scene),before=bank.inspect();let stopped=null;
  const suspension=disconnect?context.suspend(1).then(async()=>{bank.sync(disconnect);stopped=bank.inspect();await context.resume();}):null;
  try{
   const buffer=await context.startRendering();await suspension;const samples=buffer.getChannelData(0),pcm=new Uint8Array(buffer.length*2),dv=new DataView(pcm.buffer);
   for(let i=0;i<samples.length;i++)dv.setInt16(i*2,Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),true);
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',samples.buffer))).map(x=>x.toString(16).padStart(2,'0')).join('');
   return {voices,before,stopped,state:context.state,rate,sampleCount:samples.length,rms:rms(samples,rate*2,rate*3),initialRms:rms(samples,rate/2,rate),amplitudes:frequencies.map(hz=>spectrum(samples,hz,rate)),offFrequency:spectrum(samples,149,rate),hash,pcm:btoa(Array.from(pcm,x=>String.fromCharCode(x)).join(''))};
  }finally{bank.dispose();}
 };
 const fields=identities.map(identity=>createEvidenceField({identity,channel:'direct-planetary-resonance',sound:true},view,scene.id)),sounding=fields.map(field=>field.sound(scene));
 const a=await render(sounding[0]),b=await render(sounding[1]);
 for(let i=0;i<2;i++){
  const run=[a,b][i],partition=identities[i].reading.natal_composition.presentation_partition;check(run.voices.length===7,'Seven native voices');
  for(let ordinal=0;ordinal<7;ordinal++){
   const row=identities[i].reading.natal_composition.planetary_contributions.find(r=>r.receiving_centre_ordinal===ordinal);
   check(row.native_cousto_frequency_hz===frequencies[ordinal],'Native planetary frequency');
   const entity=scene.entities.find(e=>e.native?.chakraId===['muladhara','svadhisthana','manipura','anahata','vishuddha','ajna','sahasrara'][ordinal]),voice=run.voices.find(v=>v.entityId===entity.id);
   const expected=(entity.sound?.gain??DEFAULT_ENTITY_SOUND.gain)*partition.centres.find(c=>c.ordinal===ordinal).mass_share_l1;
   check(voice.frequencyHz===frequencies[ordinal]&&voice.gain===expected,'Exact native frequency and mass fraction times authored gain');
   check(Math.abs(run.amplitudes[ordinal]-expected/Math.SQRT2)<Math.max(1e-7,expected*.002),'Rendered frequency and gain');
  }
  check(run.offFrequency<1e-7,'No extra149Hz voice');
 }
 check(a.hash!==b.hash&&a.rms>0&&b.rms>0,'Two fresh native calculations reach distinct nonzero PCM');
 const baseline=await render(scene),disabled=createEvidenceField({identity:identities[0],channel:'direct-planetary-resonance',sound:false},view,scene.id);
 check(disabled.sound(scene)===scene,'Unselected evidence returns original material');
 const disconnected=await render(disabled.sound(scene)),released=await render(sounding[0],scene);
 check(baseline.hash===disconnected.hash,'Disconnect restores baseline PCM');
 check(baseline.rms===0&&released.rms===0&&released.initialRms>0&&released.stopped.voices.length===0,'Actual bank releases all voices to silence');
 const broken=structuredClone(identities[0]);broken.reading.natal_composition.presentation_partition.centres[0].mass_share_l1+=.1;
 let rejected=false;try{createEvidenceField({identity:broken,channel:'direct-planetary-resonance',sound:true},view,scene.id);}catch{rejected=true;}check(rejected,'Forged shares refuse before audio');
 const missing=structuredClone(view);delete missing.journey.scenes[0].entities[0].native.chakraId;
 rejected=false;try{createEvidenceField({identity:identities[0],channel:'direct-planetary-resonance',sound:true},missing,scene.id);}catch{rejected=true;}check(rejected,'Unbound centre refuses');
 check(JSON.stringify(document)===original&&JSON.stringify(scene)===material,'Source document and material unchanged');
 return {a,b,baseline,disconnected,released,expressionRef:document.expression_ref,sceneId:scene.id,frequencies,checks:14};
};`;
await build({stdin:{resolveDir:resolve('.'),contents:code},bundle:true,format:'esm',platform:'browser',nodePaths:[resolve('expressions-app/node_modules')],outfile:join(output,'probe.js')});
const server=createServer(async(req,res)=>{res.setHeader('content-type',req.url==='/probe.js'?'text/javascript':'text/html');res.end(req.url==='/probe.js'?await readFile(join(output,'probe.js')):'<!doctype html><script type="module" src="/probe.js"></script>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
const report={schema:'oi.nara-evidence-sound-native-verification/v1',pass:false,sources,ql:{path:ql,sha256:createHash('sha256').update(await readFile(ql)).digest('hex')},document:{path:documentPath,sha256:createHash('sha256').update(await readFile(documentPath)).digest('hex')},identitySources:identities.map(i=>i.source),standing:'Fresh native identity calculations, actual saved authored starter, production projection and EntitySoundBank with real browser OfflineAudioContext. Bounded sound presentation proof; not constitutional dynamics, hardware playback or whole-feature closure.'};
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>typeof window.measure==='function');
 const result=await page.evaluate(input=>window.measure(input),{document,identities});
 for(const key of ['a','b']){
  const run=result[key],pcm=Buffer.from(run.pcm,'base64'),h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(36+pcm.length,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);h.writeUInt32LE(run.rate,24);h.writeUInt32LE(run.rate*2,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(pcm.length,40);await writeFile(join(output,'identity-'+key+'.wav'),Buffer.concat([h,pcm]));
 }
 for(const run of [result.a,result.b,result.baseline,result.disconnected,result.released])delete run.pcm;
 assert.deepEqual(errors,[]);Object.assign(report,result,{pass:true,browser:browser.version()});console.log(JSON.stringify({pass:report.pass,checks:report.checks,a:report.a.rms,b:report.b.rms,baseline:report.baseline.rms,released:report.released.rms}));
}catch(error){report.failure=String(error);throw error;}
finally{await writeFile(join(output,'receipt.json'),JSON.stringify(report,null,2));await browser?.close();await new Promise(r=>server.close(r));}
