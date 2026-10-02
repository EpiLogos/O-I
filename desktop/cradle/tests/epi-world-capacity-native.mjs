/** Native torus capacity recovery proof against a retained real production
 * document. Exact renderer allocation owners; real profile and revision CAS
 * refusals. Ordinary opening/GPU/lifecycle remain the production proof. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {readEventHistory} from '../src/kernel/bridge.ts';
const config=JSON.parse(readFileSync(resolve(process.argv[2]),'utf8'));
assert.match(config.bridge,/^http:\/\/127\.0\.0\.1:\d+$/);
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=resolve(config.output);mkdirSync(out,{recursive:true});
const source=resolve(root,'expressions-app/field-studies-journeys/src/epiWorldProduction.ts');
const bundled=await build({entryPoints:[source],bundle:true,write:false,format:'esm',platform:'node',logLevel:'silent'});
const {epiTorusCapacityCorrection,epiTorusMaterialCapacity,readEpiWorldRecord}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const receipt={schema:'oi.epi-torus-capacity-native-proof/v1',passed:false,scope:'Actual native owner/immutable profile/revision CAS and exact renderer allocator; no actual GPU or installed claim',source:{path:source,sha256:sha(readFileSync(source))},checks:[],requests:[]};
const retain=(name,value)=>writeFileSync(resolve(out,name+'.json'),JSON.stringify(value,null,2)+'\n');
let seq=0;
async function op(request,label){const name=String(++seq).padStart(3,'0')+'-'+label;retain(name+'-issued',request);const result=await(await fetch(config.bridge+'/op',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)})).json();retain(name+'-response',result);receipt.requests.push(name);return result;}
const expression=request=>({op:'expression',request});
let eventGeneration;
const events=async()=>{const history=await readEventHistory({kind:'bridge',url:config.bridge},eventGeneration);eventGeneration=history.generation;return history;};
function pass(label){receipt.checks.push(label);retain('receipt',receipt);console.log('PASS',label);}
try{
 const before=await op(expression({operation:'inspect',expression_ref:config.expression_ref}),'actual-owner-basis');assert.equal(before.ok,true);const doc=before.outcome.data.document;assert.ok(doc);const record=readEpiWorldRecord(doc);assert.ok(record);assert.equal(record.authored_revision,'epi-world-20261001-v3');
 const scene=doc.scenes.find(s=>s.scene_ref===record.receiving.scene_ref),ref=record.receiving.torus.entity_ref,relations=Object.values(doc.relations),capacity=epiTorusMaterialCapacity(scene.presentation.scene,ref,record.world,relations,false);
 assert.equal(capacity.count,4009);assert.equal(capacity.required,4096);assert.equal(capacity.formation_particles,84000);assert.equal(capacity.connection_particles,28000);assert.equal(capacity.partitions.length,32);
 assert.throws(()=>epiTorusMaterialCapacity(scene.presentation.scene,ref,record.world,relations),/complete native sample domain/);
 const correction=epiTorusCapacityCorrection(doc,record);assert.equal(correction.changes.length,2);assert.deepEqual(correction.changes[0],{change:'parameter_set',entity_ref:ref,parameter:'share',value:12});
 const corrected=correction.changes[1].presentation,received=epiTorusMaterialCapacity(corrected.scene,ref,record.world,relations);assert.equal(received.count,10980);assert.equal(received.required,4096);assert.equal(received.partitions.length,32);
 assert.equal(corrected.saved.entities.find(e=>e.id===ref).share,12);const restored=structuredClone(corrected);restored.scene.entities.find(e=>e.id===ref).share=4;restored.saved.entities.find(e=>e.id===ref).share=4;delete restored.scene.epiWorld.presentation_adjustments;assert.deepEqual(restored,scene.presentation,'Only the exact torus/current/reset instance allocation and named adjustment change');
 assert.deepEqual(correction.record.profile_definitions,record.profile_definitions);assert.deepEqual(correction.record.world,record.world);assert.equal(correction.record.presentation_adjustments.at(-1).actor,'agent:codex:epi-fidelity-lead');
 pass('Actual original allocator refuses4009; corrected material admits10980 for all4096 native samples without changing complete world/private/profile/source basis');
 const mutants=[['wrong native torus subject',d=>d.entities[ref].subject.subject_ref='ql:m-coordinate:bimba:M1-5-2'],['wrong personal branch',d=>d.entities[record.receiving.personal.locus_entity_ref].subject.subject_ref='ql:m-coordinate:bimba:M4.4.4.3'],['foreign person record',d=>d.scenes.find(s=>s.scene_ref===record.receiving.scene_ref).presentation.scene.epiWorld.person_ref='person:foreign'],['different event',d=>d.scenes.find(s=>s.scene_ref===record.receiving.scene_ref).presentation.scene.epiWorld.world.event_ref='sha256:foreign'],['different instance',d=>d.expression_ref='expression:foreign'],['changed authored share',d=>d.scenes.find(s=>s.scene_ref===record.receiving.scene_ref).presentation.scene.entities.find(e=>e.id===ref).share=4.08],['changed saved reset share',d=>d.scenes.find(s=>s.scene_ref===record.receiving.scene_ref).presentation.saved.entities.find(e=>e.id===ref).share=4.08],['complete current but undersized saved reset',d=>d.scenes.find(s=>s.scene_ref===record.receiving.scene_ref).presentation.scene.entities.find(e=>e.id===ref).share=12]];
 for(const [label,mutate] of mutants){const d=structuredClone(doc);mutate(d);assert.throws(()=>epiTorusCapacityCorrection(d,record),undefined,label);}
 const small=structuredClone(scene.presentation.scene);small.field.params.count=40000;small.entities.find(e=>e.id===ref).share=12;assert.throws(()=>epiTorusMaterialCapacity(small,ref,record.world,relations),/complete native sample domain/);
 pass('Eight independent subject/person/event/instance/current/reset negatives and a low true resident budget refuse before any native edit');
 const profile=record.profile_definitions.find(d=>d.profile?.profile_ref.includes('-torus-'));assert.ok(profile);assert.equal(profile.profile.material_defaults.material.value.share,4);
 const pBefore=await op(expression({operation:'profile_inspect',profile_ref:profile.profile.profile_ref}),'immutable-v3-profile-before');assert.equal(pBefore.ok,true);const ev=await events();
 const bad=structuredClone(profile);bad.profile.material_defaults.material.value.share=12;bad.actor='agent:capacity-negative';const refused=await op(expression(bad),'same-v3-profile-redefinition');assert.ok(!refused.ok||refused.outcome.data.state!=='profile');assert.deepEqual(await events(),ev);assert.deepEqual(await op(expression({operation:'profile_inspect',profile_ref:profile.profile.profile_ref}),'immutable-v3-profile-after'),pBefore);
 pass('Real native owner refuses share12 under immutablev3 revision1 and preserves its exact share4 definition without an event');
 const stale=await op(expression({operation:'edit',expression_ref:doc.expression_ref,expected_revision:doc.revision-1,actor:'agent:capacity-negative',changes:correction.changes}),'stale-revision-correction');assert.equal(stale.ok,true);assert.equal(stale.outcome.data.state,'revision_conflict');assert.deepEqual(await events(),ev);assert.deepEqual(await op(expression({operation:'inspect',expression_ref:doc.expression_ref}),'reread-after-conflict'),before);
 const fresh=epiTorusCapacityCorrection(before.outcome.data.document,record);assert.deepEqual(fresh,correction);
 pass('Real stale nativeCAS refuses atomically; exact owner reread retains the unchanged correction basis and reproducible intent');
 retain('actual-correction-plan',{basis_revision:doc.revision,expression_ref:doc.expression_ref,changes:correction.changes,capacity,corrected_capacity:received});receipt.passed=true;retain('receipt',receipt);
}catch(error){receipt.error=String(error.stack??error);retain('receipt',receipt);console.error(error);process.exitCode=1;}
