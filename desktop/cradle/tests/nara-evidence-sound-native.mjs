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
import {EntitySoundBank,DEFAULT_ENTITY_SOUND,presentEntitySoundVoices} from './expressions-app/field-studies-journeys/src/native-field/entitySound';
let checkCount=0;const check=(v,m)=>{if(!v)throw Error(m);checkCount++;};
const rms=(s,a,b)=>Math.sqrt(s.slice(a,b).reduce((n,x)=>n+x*x,0)/(b-a));
const spectrum=(s,hz,r)=>{let re=0,im=0;for(let i=r*2;i<r*3;i++){const p=2*Math.PI*hz*i/r;re+=s[i]*Math.cos(p);im+=s[i]*Math.sin(p);}return 2*Math.hypot(re,im)/r;};
window.measure=async({document,identities})=>{
 checkCount=0;
 const view=kernelDocumentToJourney(document),scene=view.journey.scenes.find(s=>s.id===view.startSceneId)??view.journey.scenes[0];
 const original=JSON.stringify(document),material=JSON.stringify(scene),rate=48000;
 const rows=identities[0].reading.natal_composition.planetary_contributions.filter(row=>row.receiving_centre_ordinal!=null);
 const frequencies=rows.map(row=>row.native_cousto_frequency_hz);
 const render=async(plan,options={})=>{
  const context=new OfflineAudioContext(2,rate*3,rate),bank=new EntitySoundBank(()=>context);
  if(options.muted)bank.setMuted(true);
  const voices=plan==null?bank.sync(scene):bank.syncVoices(presentEntitySoundVoices(plan,scene,options.active?new Set(options.active):undefined)),before=bank.inspect();let stopped=null;
  const suspension=options.release?context.suspend(1).then(async()=>{if(options.clear)bank.clear();else bank.sync(scene);if(options.muteReleased){bank.setMuted(true);bank.setMuted(false);}stopped=bank.inspect();await context.resume();}):null;
  try{
   const buffer=await context.startRendering();await suspension;const samples=buffer.getChannelData(0),pcm=new Uint8Array(buffer.length*2),dv=new DataView(pcm.buffer);
   for(let i=0;i<samples.length;i++)dv.setInt16(i*2,Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),true);
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',samples.buffer))).map(x=>x.toString(16).padStart(2,'0')).join('');
   return {voices,before,stopped,state:context.state,rate,sampleCount:samples.length,rms:rms(samples,rate*2,rate*3),initialRms:rms(samples,rate/2,rate),tailRms:rms(samples,Math.floor(rate*1.1),Math.floor(rate*1.4)),amplitudes:frequencies.map(hz=>spectrum(samples,hz,rate)),offFrequency:spectrum(samples,149,rate),hash,pcm:btoa(Array.from(pcm,x=>String.fromCharCode(x)).join(''))};
  }finally{bank.dispose();}
 };
 const fields=identities.map(identity=>createEvidenceField({identity,channel:'direct-planetary-resonance',sound:true},view,scene.id)),sounding=fields.map(field=>field.sound(scene));
 const a=await render(sounding[0]),b=await render(sounding[1]);
 for(let i=0;i<2;i++){
  const run=[a,b][i],natal=identities[i].reading.natal_composition,partition=natal.presentation_partition,denominator=natal.planetary_contributions.reduce((n,row)=>n+row.weighted_contribution,0);
  check(run.voices.length===9&&run.before.voices.length===9&&new Set(run.voices.map(v=>v.voiceRef)).size===9&&new Set(run.voices.map(v=>v.entityId)).size===7,'Nine independently admitted native voices through seven receiving bodies');
  for(const row of natal.planetary_contributions.filter(row=>row.receiving_centre_ordinal!=null)){
   const entity=scene.entities.find(e=>e.native?.chakraId===['muladhara','svadhisthana','manipura','anahata','vishuddha','ajna','sahasrara'][row.receiving_centre_ordinal]);
   const matching=run.voices.filter(v=>v.entityId===entity.id&&v.frequencyHz===row.native_cousto_frequency_hz);check(matching.length===1,'Every native planet retains its distinct target/frequency');
   const voice=matching[0],expected=(entity.sound?.gain??DEFAULT_ENTITY_SOUND.gain)*(row.weighted_contribution/denominator);
   check(voice.gain===expected,'Exact individual native weight/all-ten denominator times authored gain');
   check(voice.waveform==='sine'&&voice.pan===0,'Controlled spectral proof requires unchanged native scene sine/centre-pan material');
   const index=frequencies.indexOf(row.native_cousto_frequency_hz);check(Math.abs(run.amplitudes[index]-expected/Math.SQRT2)<Math.max(1e-7,expected*.002),'Actual rendered independent frequency and gain');
  }
  for(let ordinal=0;ordinal<7;ordinal++){
   const entity=scene.entities.find(e=>e.native?.chakraId===['muladhara','svadhisthana','manipura','anahata','vishuddha','ajna','sahasrara'][ordinal]);
   const gain=run.voices.filter(v=>v.entityId===entity.id).reduce((n,v)=>n+v.gain,0),expected=(entity.sound?.gain??DEFAULT_ENTITY_SOUND.gain)*partition.centres.find(c=>c.ordinal===ordinal).mass_share_l1;
   check(Math.abs(gain-expected)<1e-12,'Shared-centre voices reconstruct exactly the native centre share');
  }
  check(run.offFrequency<1e-7,'No extra149Hz voice');
 }
 check(a.hash!==b.hash&&a.rms>0&&b.rms>0,'Two fresh native natal calculations reach distinct nonzero PCM');
 const baseline=await render(null),disabled=createEvidenceField({identity:identities[0],channel:'direct-planetary-resonance',sound:false},view,scene.id);
 check(disabled.sound(scene)===null,'Unselected evidence supplies no private audio plan');
 const disconnected=await render(disabled.sound(scene)),released=await render(sounding[0],{release:true});
 check(baseline.hash===disconnected.hash,'Disconnect restores authored baseline PCM');
 check(baseline.rms===0&&released.rms===0&&released.initialRms>0&&released.stopped.voices.length===0,'Actual bank releases all nine voices to silence');
 const mutedDeparture=await render(sounding[0],{release:true,muteReleased:true});check(released.tailRms>0&&mutedDeparture.tailRms<1e-8&&mutedDeparture.stopped.voices.length===0,'Mute cancels departing private tails; immediate unmute cannot resurrect removed voices');
 const cleared=await render(sounding[0],{release:true,clear:true});check(cleared.tailRms<1e-8&&cleared.stopped.voices.length===0&&cleared.stopped.retiringVoiceCount===0,'Explicit private custody release immediately clears active and retiring nodes');
 const zeroScene=structuredClone(scene);for(const entity of zeroScene.entities)if(entity.native?.chakraId)entity.sound={...entity.sound,enabled:true,gain:0};
 const zeroPlan=fields[0].sound(zeroScene),zero=await render(zeroPlan),muted=await render(sounding[0],{muted:true}),repeat=await render(sounding[0]);
 check(JSON.stringify(zeroPlan.map(v=>[v.voiceRef,v.entityId,v.frequencyHz]))===JSON.stringify(sounding[0].map(v=>[v.voiceRef,v.entityId,v.frequencyHz])),'Live zero retains exact same nine source voices/frequencies');
 check(zero.before.voices.length===9&&muted.before.voices.length===9&&zero.rms===0&&muted.rms===0,'Zero gain and mute retain nine receiving oscillators while actual PCM is silent');
 check(repeat.hash===a.hash,'Exact controlled positive replay repeats');
 const focused=[];
 for(const ordinal of [5,6]){
  const entity=scene.entities.find(e=>e.native?.chakraId===['muladhara','svadhisthana','manipura','anahata','vishuddha','ajna','sahasrara'][ordinal]),run=await render(sounding[0],{active:[entity.id]});
  const nativeRows=rows.filter(row=>row.receiving_centre_ordinal===ordinal);check(run.voices.length===2&&nativeRows.length===2,'Both planetary voices survive shared-centre focus');
  for(const row of nativeRows)check(run.amplitudes[frequencies.indexOf(row.native_cousto_frequency_hz)]>1e-7,'Each exact shared-centre frequency reaches actual focused PCM');
  for(const row of rows.filter(row=>row.receiving_centre_ordinal!==ordinal))check(run.amplitudes[frequencies.indexOf(row.native_cousto_frequency_hz)]<1e-7,'Unfocused centre frequencies are absent');
  focused.push(run);
 }
 const broken=structuredClone(identities[0]);broken.reading.natal_composition.presentation_partition.centres[0].mass_share_l1+=.1;
 let rejected=false;try{createEvidenceField({identity:broken,channel:'direct-planetary-resonance',sound:true},view,scene.id);}catch{rejected=true;}check(rejected,'Forged shares refuse before audio');
 const missing=structuredClone(view),target=missing.journey.scenes.find(s=>s.id===scene.id).entities.find(e=>e.native?.chakraId);delete target.native.chakraId;
 rejected=false;try{createEvidenceField({identity:identities[0],channel:'direct-planetary-resonance',sound:true},missing,scene.id);}catch{rejected=true;}check(rejected,'Unbound centre refuses');
 check(fields[0].sound({...scene,id:'other-scene'})===null,'Private plan cannot cross a scene identity');
 check(JSON.stringify(document)===original&&JSON.stringify(scene)===material,'Source document and material unchanged');
 return {a,b,baseline,disconnected,released,mutedDeparture,cleared,zero,muted,repeat,focused,expressionRef:document.expression_ref,sceneId:scene.id,frequencies,checks:checkCount};
};`;
await build({stdin:{resolveDir:resolve('.'),contents:code},bundle:true,format:'esm',platform:'browser',nodePaths:[resolve('expressions-app/node_modules')],outfile:join(output,'probe.js')});
const server=createServer(async(req,res)=>{res.setHeader('content-type',req.url==='/probe.js'?'text/javascript':'text/html');res.end(req.url==='/probe.js'?await readFile(join(output,'probe.js')):'<!doctype html><script type="module" src="/probe.js"></script>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
const report={schema:'oi.nara-evidence-sound-native-verification/v1',pass:false,sources,ql:{path:ql,sha256:createHash('sha256').update(await readFile(ql)).digest('hex')},document:{path:documentPath,sha256:createHash('sha256').update(await readFile(documentPath)).digest('hex')},identitySources:identities.map(i=>i.source),standing:'Fresh native natal identity calculations, actual saved authored starter, private nine-voice production plan and EntitySoundBank with real browser OfflineAudioContext. Bounded natal sound presentation proof; current person/occasion host admission, ordinary application, shared native M2 PCM, hardware playback, hearing and H remain separate.'};
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>typeof window.measure==='function');
 const result=await page.evaluate(input=>window.measure(input),{document,identities});
 for(const key of ['a','b']){
  const run=result[key],pcm=Buffer.from(run.pcm,'base64'),h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(36+pcm.length,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);h.writeUInt32LE(run.rate,24);h.writeUInt32LE(run.rate*2,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(pcm.length,40);await writeFile(join(output,'identity-'+key+'.wav'),Buffer.concat([h,pcm]));
 }
 for(const run of [result.a,result.b,result.baseline,result.disconnected,result.released,result.mutedDeparture,result.cleared,result.zero,result.muted,result.repeat,...result.focused])delete run.pcm;
 assert.deepEqual(errors,[]);Object.assign(report,result,{pass:true,browser:browser.version()});console.log(JSON.stringify({pass:report.pass,checks:report.checks,a:report.a.rms,b:report.b.rms,baseline:report.baseline.rms,released:report.released.rms}));
}catch(error){report.failure=String(error);throw error;}
finally{await writeFile(join(output,'receipt.json'),JSON.stringify(report,null,2));await browser?.close();await new Promise(r=>server.close(r));}
