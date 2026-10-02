/** Pure receiving semantics against retained, actual controlled native data.
 * OI_NARA_SOUND_PLAN_CONFIG=/absolute/config.json node --test tests/nara-sound-plan-retained-native.test.mjs
 * No native operation, provider, application build, browser or audio context.
 * This does not establish live currentness, DSP, installed sound or listening.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {join,resolve,isAbsolute} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import ts from '../expressions-app/node_modules/typescript/lib/typescript.js';

const configPath=process.env.OI_NARA_SOUND_PLAN_CONFIG;
assert.ok(configPath&&isAbsolute(configPath),'An explicit actual controlled native input configuration is required');
const config=JSON.parse(await readFile(configPath,'utf8'));
for(const key of ['native_receipt_file','native_document_file','receipt_file'])assert.ok(isAbsolute(config[key]??''),key);
const root=resolve(import.meta.dirname,'..'),temp=await mkdtemp(join(tmpdir(),'oi-native-sound-plan-'));
const digest=b=>createHash('sha256').update(b).digest('hex');
const sources={},rss=[process.memoryUsage().rss];
const paths={sound:'expressions-app/field-studies-journeys/src/native-field/entitySound.ts',force:'expressions-app/src/engine/naraEvidenceProjection.ts',evidence:'expressions-app/field-studies-journeys/src/naraEvidenceField.ts'};
for(const [name,path] of Object.entries(paths)){
 const raw=await readFile(join(root,path),'utf8');sources[path]=digest(raw);
 let code=ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
 if(name==='evidence')code=code.replaceAll("'../../src/engine/naraEvidenceProjection'","'./force.mjs'").replaceAll("'./native-field/entitySound'","'./sound.mjs'");
 await writeFile(join(temp,name+'.mjs'),code);
}
const {projectNativePlanetaryResonanceDrivers,projectNativePlanetarySoundVoices}=await import(pathToFileURL(join(temp,'evidence.mjs')));
const {presentEntitySoundVoices,validateEntitySound,DEFAULT_ENTITY_SOUND}=await import(pathToFileURL(join(temp,'sound.mjs')));
const nativeBytes=await readFile(config.native_receipt_file),documentBytes=await readFile(config.native_document_file);
const nativeReceipt=JSON.parse(nativeBytes),data=nativeReceipt.response?.outcome?.data;
assert.equal(nativeReceipt.request?.op,'nara_identity');assert.equal(nativeReceipt.request?.request?.operation,'personal_current');
assert.equal(nativeReceipt.response?.ok,true);
const current=data.personal_current,identity=current.identity;
assert.match(identity.person_ref,/^(person:controlled-world-[ab]|controlled:native-replay:(one|two))$/,'Only the attributed controlled proof identities may enter this test');
const natal=identity.natal_composition,partition=natal.presentation_partition;
const rawDocument=JSON.parse(documentBytes),document=rawDocument.document??rawDocument;
const nativeScene=document.scenes.find(scene=>scene.scene_ref===document.reuse?.states?.personal);
assert.ok(nativeScene?.presentation?.scene,'An actual retained native personal scene is required');
const scene=nativeScene.presentation.scene;
const centres=['muladhara','svadhisthana','manipura','anahata','vishuddha','ajna','sahasrara'];
const bindings=centres.map((id,ordinal)=>{
 const bodies=scene.entities.filter(entity=>entity.native?.chakraId===id);assert.equal(bodies.length,1);
 const body=bodies[0],zone=natal.centre_evidence.find(row=>row.ordinal===ordinal).body.body_zone;
 assert.ok(nativeScene.entity_refs.includes(body.id));
 const subject=document.entities[body.id].subject,ref='ql:m-coordinate:bimba:M'+zone.source_ref.slice(1);
 assert.equal(subject.native_owner,'ql-mef');assert.equal(subject.subject_ref,ref);
 assert.ok(subject.sources.some(source=>source.ref===ref&&source.revision===zone.registry_revision&&source.availability==='available'));
 return {ordinal,entityId:body.id};
});
const sourceRef=data.source.source_ref,scope=JSON.stringify([document.expression_ref,nativeScene.scene_ref,sourceRef,data.source.revision,identity.person_ref,identity.input_revision,current.snapshot_ref]);
const drivers=projectNativePlanetaryResonanceDrivers(natal,partition,bindings,sourceRef);
const plan=projectNativePlanetarySoundVoices(drivers,scene,scope),original=JSON.stringify({nativeReceipt,document});
const rows=natal.planetary_contributions,denominator=rows.reduce((sum,row)=>sum+row.weighted_contribution,0);
rss.push(process.memoryUsage().rss);
const checks=[];
const record=name=>checks.push(name);

test('actual native ten-body basis retains nine independent voices through seven source-bound bodies',()=>{
 assert.equal(rows.length,10);assert.equal(drivers.length,9);assert.equal(plan.length,9);
 assert.equal(new Set(plan.map(voice=>voice.voiceRef)).size,9);assert.equal(new Set(plan.map(voice=>voice.entityId)).size,7);
 assert.deepEqual(presentEntitySoundVoices(plan,scene),plan);
 for(const row of rows.filter(row=>row.native_planet_id!==7)){
  const driver=drivers.find(driver=>driver.driverRef===JSON.stringify([sourceRef,row.native_planet_id]));
  const voice=plan.find(voice=>voice.voiceRef===JSON.stringify([scope,driver.driverRef]));
  const body=scene.entities.find(entity=>entity.id===driver.entityId);
  assert.equal(voice.entityId,bindings[row.receiving_centre_ordinal].entityId);
  assert.equal(voice.frequencyHz,row.native_cousto_frequency_hz);
  assert.equal(voice.gain,(body.sound?.gain??DEFAULT_ENTITY_SOUND.gain)*(row.weighted_contribution/denominator));
  const route=row.planetary_chakra_route;assert.equal(route.chakra_index,row.receiving_centre_ordinal+1);
  assert.equal(route.source_revision,'907c46bc8a65b47e12f14aa4d8b444263dc956a1a7b4b6d038e57223d6073288');
  assert.ok(route.relations.some(relation=>relation.orientation==='directed'&&relation.from_ref===route.planet_coordinate&&relation.to_ref===route.chakra_coordinate&&relation.source_kind===(row.native_planet_id>=8?'HAS_CHAKRAL_ANCHOR':'PLANETARY_RESONANCE')));
 }
 const uranus=rows.find(row=>row.native_planet_id===7);assert.equal(uranus.receiving_centre_ordinal,null);assert.equal(uranus.planetary_chakra_route,null);
 assert.ok(uranus.weighted_contribution>0);
 assert.ok(Math.abs(drivers.reduce((sum,driver)=>sum+driver.driveShare,0)-(1-uranus.weighted_contribution/denominator))<1e-10,'Uranus stays in the denominator without an invented voice');
 record('Exact native frequencies, individual weights, typed directed routes, nine voices/seven actual source-bound bodies and retained unvoiced Uranus');
});
test('both qualified bodies of a shared centre survive target focus and authored zero gain',()=>{
 for(const [ordinal,names] of [[5,['Moon','Neptune']],[6,['Sun','Pluto']]]){
  const focused=presentEntitySoundVoices(plan,scene,new Set([bindings[ordinal].entityId]));assert.equal(focused.length,2);
  assert.deepEqual(focused.map(voice=>voice.frequencyHz),rows.filter(row=>names.includes(row.body)).map(row=>row.native_cousto_frequency_hz));
 }
 const zero=structuredClone(scene);for(const body of zero.entities)if(body.native?.chakraId)body.sound={...body.sound,enabled:true,gain:0};
 const silent=projectNativePlanetarySoundVoices(drivers,zero,scope);
 assert.deepEqual(silent.map(voice=>[voice.voiceRef,voice.entityId,voice.frequencyHz]),plan.map(voice=>[voice.voiceRef,voice.entityId,voice.frequencyHz]));assert.ok(silent.every(voice=>voice.gain===0));
 assert.deepEqual(drivers,projectNativePlanetaryResonanceDrivers(natal,partition,bindings,sourceRef),'Gain changes cannot remove or rewrite native drivers');
 assert.deepEqual(presentEntitySoundVoices(plan,{entities:[]}),[]);
 record('Moon/Neptune and Sun/Pluto both survive focus; live zero retains all nine voice identities/frequencies; departed bodies receive none');
});
test('invalid native basis, missing body, duplicate voice and private portable material refuse',()=>{
 const missing=structuredClone(scene);missing.entities=missing.entities.filter(entity=>entity.id!==bindings[5].entityId);
 assert.throws(()=>projectNativePlanetarySoundVoices(drivers,missing,scope),/no receiving body/);
 assert.throws(()=>presentEntitySoundVoices([...plan,plan[0]],scene),/unique voiceRef/);
 assert.throws(()=>presentEntitySoundVoices([{...plan[0],frequencyHz:0}],scene),/frequencyHz/);
 assert.throws(()=>validateEntitySound({enabled:true,voices:plan}),/unsupported field voices/);
 const duplicate=structuredClone(natal);duplicate.planetary_contributions[0].native_planet_id=1;
 assert.throws(()=>projectNativePlanetaryResonanceDrivers(duplicate,partition,bindings,sourceRef),/ten distinct/);
 const invented=structuredClone(natal);invented.planetary_contributions.find(row=>row.native_planet_id===7).receiving_centre_ordinal=0;
 assert.throws(()=>projectNativePlanetaryResonanceDrivers(invented,partition,bindings,sourceRef),/remain unvoiced/);
 assert.equal(JSON.stringify({nativeReceipt,document}),original);
 record('Missing body, duplicate native/voice identity, invalid frequency, invented Uranus route and portable private plan all refuse; actual source remains byte-equivalent');
});
test.after(async()=>{
 rss.push(process.memoryUsage().rss);
 await writeFile(config.receipt_file,JSON.stringify({schema:'oi.nara-sound-retained-native-semantics/v1',passed:checks.length===3,checks,sources,inputs:{native_receipt:{path:config.native_receipt_file,sha256:digest(nativeBytes)},native_document:{path:config.native_document_file,sha256:digest(documentBytes)}},resource:{measured_rss_bytes:rss},standing:'Pure production adapter semantics over retained controlled native contributions and an independently source-qualified saved scene. These inputs do not form a live current-person/occasion/DSP chain. No native process, provider, browser, AudioContext, app build, installation, playback or listening proof.'},null,2)+'\n');
 await rm(temp,{recursive:true,force:true});
});
