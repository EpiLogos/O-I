/** Actual controlled native saved-material negative and recovery. This is a
 * deliberate owner fault injection, not authored material or installed proof. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
const config=JSON.parse(readFileSync(resolve(process.argv[2]),'utf8'));
assert.match(config.bridge,/^http:\/\/127\.0\.0\.1:\d+$/);assert.ok(config.expression_ref.startsWith('expression:epi-'));
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=resolve(config.output);mkdirSync(out,{recursive:true});
const source=resolve(root,'expressions-app/field-studies-journeys/src/epiWorldProduction.ts');
const compiled=await build({entryPoints:[source],bundle:true,write:false,format:'esm',platform:'node',logLevel:'silent'});
const {epiTorusCapacityCorrection,readEpiWorldRecord}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const receipt={schema:'oi.epi-torus-saved-capacity-native-negative/v1',passed:false,scope:'Actual controlled nativeCAS saved-material fault, exact owner readback, production correction guard and explicit restore; optional current/reset fault is retained solely for ordinary production regression. No numerical/semantic/history/profile or installed rewrite.',source:{path:source,sha256:createHash('sha256').update(readFileSync(source)).digest('hex')},checks:[],requests:[]};
const retain=(name,value)=>writeFileSync(resolve(out,name+'.json'),JSON.stringify(value,null,2)+'\n');let seq=0;
async function op(request,label){const name=String(++seq).padStart(3,'0')+'-'+label;retain(name+'-issued',request);const r=await(await fetch(config.bridge+'/op',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'expression',request})})).json();retain(name+'-response',r);receipt.requests.push(name);assert.equal(r.ok,true,r.error);return r.outcome.data;}
function pass(label){receipt.checks.push(label);retain('receipt',receipt);console.log('PASS',label);}
let original,restoreRequired=false;
try{
 original=await op({operation:'inspect',expression_ref:config.expression_ref},'actual-corrected-document');const d=original.document,w=readEpiWorldRecord(d),ref=w.receiving.torus.entity_ref,s=d.scenes.find(s=>s.scene_ref===w.receiving.scene_ref);assert.ok(w.person_ref.startsWith('person:controlled-'),'Only explicit controlled acceptance people may undergo this native fault injection');
 assert.equal(d.entities[ref].parameters.share.value,12);assert.equal(s.presentation.scene.entities.find(e=>e.id===ref).share,12);assert.equal(s.presentation.saved.entities.find(e=>e.id===ref).share,12);assert.equal(epiTorusCapacityCorrection(d,w).changes.length,0);assert.equal(w.profile_definitions.find(p=>p.profile?.profile_ref.includes('-torus-')).profile.material_defaults.material.value.share,4);
 pass('Actual corrected native parameter/current/reset share12 is idempotent and preserves immutablev3 share4');
 const bad=structuredClone(s.presentation);bad.saved.entities.find(e=>e.id===ref).share=4;
 const changed=await op({operation:'edit',expression_ref:d.expression_ref,expected_revision:d.revision,actor:'agent:capacity-regression-native-negative',changes:[{change:'scene_material_set',scene_ref:s.scene_ref,presentation:bad}]},'deliberate-saved-only-fault');assert.equal(changed.state,'ready');restoreRequired=true;
 const actual=await op({operation:'inspect',expression_ref:d.expression_ref},'actual-saved-only-fault');assert.deepEqual(actual.document,changed.document);assert.equal(actual.document.entities[ref].parameters.share.value,12);assert.equal(actual.document.scenes.find(s=>s.scene_ref===w.receiving.scene_ref).presentation.saved.entities.find(e=>e.id===ref).share,4);assert.deepEqual(readEpiWorldRecord(actual.document),w);assert.throws(()=>epiTorusCapacityCorrection(actual.document,w),/complete native sample domain/);
 pass('A real native current12/saved4 material fault is detected by the production guard; current capacity cannot false-pass Restore');
 const restored=await op({operation:'edit',expression_ref:d.expression_ref,expected_revision:actual.document.revision,actor:'agent:capacity-regression-native-restore',changes:[{change:'scene_material_set',scene_ref:s.scene_ref,presentation:s.presentation}]},'restore-exact-saved-material');assert.equal(restored.state,'ready');restoreRequired=false;
 const reread=await op({operation:'inspect',expression_ref:d.expression_ref},'actual-restored-owner');assert.deepEqual(reread.document,restored.document);assert.equal(epiTorusCapacityCorrection(reread.document,w).changes.length,0);
 const comparable=structuredClone(reread.document);comparable.revision=d.revision;for(const scene of comparable.scenes)scene.revision=d.scenes.find(s=>s.scene_ref===scene.scene_ref).revision;for(const [ref,entity] of Object.entries(comparable.entities))entity.revision=d.entities[ref].revision;assert.deepEqual(comparable,d);
 pass('Actual native restore changes only owner revision counters and exactly restores every source, private world, entity, current and saved material field');
 if(config.replay_fault===true){
  const broken=structuredClone(s.presentation);for(const value of [broken.scene,broken.saved])value.entities.find(e=>e.id===ref).share=4;
  const fault=await op({operation:'edit',expression_ref:d.expression_ref,expected_revision:reread.document.revision,actor:'agent:capacity-regression-native-negative',changes:[{change:'parameter_set',entity_ref:ref,parameter:'share',value:4},{change:'scene_material_set',scene_ref:s.scene_ref,presentation:broken}]},'deliberate-current-reset-regression-fault');assert.equal(fault.state,'ready');const observed=await op({operation:'inspect',expression_ref:d.expression_ref},'actual-regression-fault-owner');assert.deepEqual(readEpiWorldRecord(observed.document),w);const correction=epiTorusCapacityCorrection(observed.document,w);assert.equal(correction.changes.length,2);assert.equal(correction.record.presentation_adjustments.length,w.presentation_adjustments.length+1);assert.deepEqual(correction.record.presentation_adjustments.slice(0,-1),w.presentation_adjustments);
  const file=observed.file;assert.ok(file);const saved=await op({operation:'save',expression_ref:d.expression_ref,expected_revision:observed.document.revision,location:file.location,expected_file_revision:file.revision,actor:'agent:capacity-regression-native-negative',actor_kind:'agent'},'same-file-guarded-regression-fault-save');assert.equal(saved.state,'saved');assert.equal(saved.readback_verified,true);const decoded=await op({operation:'inspect_file',location:file.location,expected_file_revision:saved.file.revision},'actual-regression-file');assert.deepEqual(decoded.document,observed.document);
  retain('deliberate-regression-fault',{actor:'agent:capacity-regression-native-negative',basis:d.revision,owner_revision:observed.document.revision,original_actual_file:original.file,regression_file:saved.file,semantic_world_unchanged:true,immutable_profiles_unchanged:true,historical_adjustment_retained:w.presentation_adjustments,following_replay_required:true});
  pass('An explicitly labelled real native current/reset4 fault is saved to the same controlled file for ordinary original-failure replay, preserving world/person/occasion and historical first adjustment');
 }
 receipt.passed=true;retain('receipt',receipt);
}catch(error){receipt.error=String(error.stack??error);retain('receipt',receipt);console.error(error);process.exitCode=1;
 if(restoreRequired&&original){try{const current=await op({operation:'inspect',expression_ref:config.expression_ref},'emergency-owner-reread');const w=readEpiWorldRecord(original.document),scene=original.document.scenes.find(s=>s.scene_ref===w.receiving.scene_ref);await op({operation:'edit',expression_ref:config.expression_ref,expected_revision:current.document.revision,actor:'agent:capacity-regression-native-restore',changes:[{change:'scene_material_set',scene_ref:scene.scene_ref,presentation:scene.presentation}]},'emergency-exact-restore');}catch(restoreError){receipt.restore_error=String(restoreError);retain('receipt',receipt);}}
}
