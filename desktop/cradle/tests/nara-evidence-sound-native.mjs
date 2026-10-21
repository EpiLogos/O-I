/** Actual saved native identities and document -> production sound plan (a symbol's voice carries the torus's sound; no oscillator).
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
import {entitySoundPlan,DEFAULT_ENTITY_SOUND} from './expressions-app/field-studies-journeys/src/native-field/entitySound';
const check=(v,m)=>{if(!v)throw Error(m);};
const CENTRES=['muladhara','svadhisthana','manipura','anahata','vishuddha','ajna','sahasrara'];
window.measure=async({document,identities})=>{
 const view=kernelDocumentToJourney(document),scene=view.journey.scenes.find(s=>s.id===view.startSceneId)??view.journey.scenes[0];
 const original=JSON.stringify(document),material=JSON.stringify(scene);
 // A symbol's voice carries a name or a mode of the torus's sound and has no oscillator of its own: the evidence weighs each centre's voice by
 // the centre's share of the partition and makes no tone of the planet's frequency. Give each centre a mode to carry, as the author would.
 const carrying=structuredClone(scene);
 for(const entity of carrying.entities)if(entity.native?.chakraId)entity.sound={enabled:true,carry:{kind:'mode',ref:'maqam/00'}};
 const fields=identities.map(identity=>createEvidenceField({identity,channel:'direct-planetary-resonance',sound:true},view,scene.id)),sounding=fields.map(field=>field.sound(carrying));
 const plans=sounding.map(s=>entitySoundPlan(s));
 for(let i=0;i<2;i++){
  const partition=identities[i].reading.natal_composition.presentation_partition,plan=plans[i];check(plan.voices.length===7,'Seven native voices');
  for(let ordinal=0;ordinal<7;ordinal++){
   const entity=scene.entities.find(e=>e.native?.chakraId===CENTRES[ordinal]),voice=plan.voices.find(v=>v.entityId===entity.id);
   const expected=DEFAULT_ENTITY_SOUND.gain*partition.centres.find(c=>c.ordinal===ordinal).mass_share_l1;
   check(voice&&voice.gain===expected,'Authored gain times the centre mass fraction');
   check(!('frequencyHz' in voice)&&!('waveform' in voice)&&!('pan' in voice),'No oscillator field in a voice');
   check(voice.carry.kind==='mode'&&voice.carry.ref==='maqam/00','The voice carries what the author chose, not a tone made from the planet');
  }
 }
 check(JSON.stringify(plans[0].voices.map(v=>v.gain))!==JSON.stringify(plans[1].voices.map(v=>v.gain)),'Two fresh native calculations weigh the voices differently');
 // A centre whose voice carries nothing yet stays silent and says so: the evidence invents no carry.
 const bare=fields[0].sound(scene),barePlan=entitySoundPlan(bare);
 check(barePlan.voices.length===0&&barePlan.silent.length===7,'Centres with no carry are silent, all seven, with their reason');
 const disabled=createEvidenceField({identity:identities[0],channel:'direct-planetary-resonance',sound:false},view,scene.id);
 check(disabled.sound(scene)===scene,'Unselected evidence returns original material');
 const broken=structuredClone(identities[0]);broken.reading.natal_composition.presentation_partition.centres[0].mass_share_l1+=.1;
 let rejected=false;try{createEvidenceField({identity:broken,channel:'direct-planetary-resonance',sound:true},view,scene.id);}catch{rejected=true;}check(rejected,'Forged shares refuse before audio');
 const missing=structuredClone(view);delete missing.journey.scenes[0].entities[0].native.chakraId;
 rejected=false;try{createEvidenceField({identity:identities[0],channel:'direct-planetary-resonance',sound:true},missing,scene.id);}catch{rejected=true;}check(rejected,'Unbound centre refuses');
 check(JSON.stringify(document)===original&&JSON.stringify(scene)===material,'Source document and material unchanged');
 return {a:plans[0],b:plans[1],bare:barePlan,expressionRef:document.expression_ref,sceneId:scene.id,checks:10};
};`;
await build({stdin:{resolveDir:resolve('.'),contents:code},bundle:true,format:'esm',platform:'browser',nodePaths:[resolve('expressions-app/node_modules')],outfile:join(output,'probe.js')});
const server=createServer(async(req,res)=>{res.setHeader('content-type',req.url==='/probe.js'?'text/javascript':'text/html');res.end(req.url==='/probe.js'?await readFile(join(output,'probe.js')):'<!doctype html><script type="module" src="/probe.js"></script>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
const report={schema:'oi.nara-evidence-sound-native-verification/v1',pass:false,sources,ql:{path:ql,sha256:createHash('sha256').update(await readFile(ql)).digest('hex')},document:{path:documentPath,sha256:createHash('sha256').update(await readFile(documentPath)).digest('hex')},identitySources:identities.map(i=>i.source),standing:'Fresh native identity calculations, actual saved authored starter and the production projection of the evidence onto the symbols\' voices (entitySoundPlan). A voice has no oscillator: the evidence weighs it by the centre share. Bounded presentation proof; not audio, constitutional dynamics, hardware playback or whole-feature closure.'};
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>typeof window.measure==='function');
 const result=await page.evaluate(input=>window.measure(input),{document,identities});
 assert.deepEqual(errors,[]);Object.assign(report,result,{pass:true,browser:browser.version()});console.log(JSON.stringify({pass:report.pass,checks:report.checks,a:report.a.voices.map(v=>v.gain),b:report.b.voices.map(v=>v.gain)}));
}catch(error){report.failure=String(error);throw error;}
finally{await writeFile(join(output,'receipt.json'),JSON.stringify(report,null,2));await browser?.close();await new Promise(r=>server.close(r));}
