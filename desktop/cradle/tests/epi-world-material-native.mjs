#!/usr/bin/env node
/** Real native whole-material construction/readback. A controlled native
 * bridge + admitted EpiMaterialInput are required. No fake transport, source
 * graph, numerical clock or quaternion. This does not claim installed pixels.
 * node tests/epi-world-material-native.mjs /absolute/replay-config.json
 * Config additionally requires world_file: the actual admitted native world
 * behind input_file, so prepared material alone cannot stand in for its owner.
 * mode offline-inheritance requires native_receipt_dir; it reads retained
 * actual owner profile/CAS receipts without calling or mutating a bridge.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(!process.argv[2])throw Error('Supply real native replay config (bridge, input_file, world_file, output, mode construct|verify|offline-inheritance).');
const config=JSON.parse(await readFile(process.argv[2],'utf8'));
assert.match(config.bridge,/^http:\/\/127\.0\.0\.1:\d+$/);
assert.ok(config.output.includes('/Control/agents/now/clearings/')&&config.output.includes('/T/'));
assert.ok(['construct','verify','offline-inheritance'].includes(config.mode));
await mkdir(config.output,{recursive:true});
const input=JSON.parse(await readFile(config.input_file,'utf8'));
assert.ok(path.isAbsolute(config.world_file),'Retain the actual native constructor output independently of prepared material.');
const ownerWorld=JSON.parse(await readFile(config.world_file,'utf8'));
assert.match(input.document.expression_ref,/^expression:controlled-/,'Construction and mutation proofs must use a controlled actual native Expression.');
const modulePath=root+'/expressions-app/field-studies-journeys/src/epiWorldMaterial.ts';
const bundle=config.output+'/epi-world-material-owner-consumers.mjs';
await build({stdin:{contents:`export * from ${JSON.stringify(modulePath)}; export {sceneWorldFromNative} from ${JSON.stringify(root+'/expressions-app/field-studies-journeys/src/epiWorldSource.ts')}; export {createEvidenceField} from ${JSON.stringify(root+'/expressions-app/field-studies-journeys/src/naraEvidenceField.ts')}; export {kernelDocumentToJourney} from ${JSON.stringify(root+'/expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts')}; export {toNativeConfig} from ${JSON.stringify(root+'/expressions-app/field-studies-journeys/src/nativeBridge.ts')};`,resolveDir:root,sourcefile:'actual-native-world-owner-consumers.ts',loader:'ts'},outfile:bundle,bundle:true,platform:'node',format:'esm',logLevel:'warning'});
const m=await import(bundle),plan=m.buildEpiWorldMaterial(input),operations=[];
const parsedWorld=m.sceneWorldFromNative(ownerWorld,input.scene_reading,ref=>{throw Error('The current native source pointer is not qualified: '+ref);});
assert.equal(ownerWorld.instance_ref,input.document.expression_ref);assert.equal(ownerWorld.subject_ref,input.personal.person.ref);
for(const key of ['scene','event','clocks','form_material'])assert.deepEqual(input[key],parsedWorld[key],`Prepared ${key} differs from the actual native constructor/receiving basis.`);
for(const [role,members] of Object.entries(parsedWorld.registers))assert.deepEqual(input.registers[role].members,members,'Prepared register membership differs from actual native source owner.');
const lostConsumer=structuredClone(ownerWorld);lostConsumer.basis.m2_input.resonator.modes.pop();lostConsumer.binding.native_basis=structuredClone(lostConsumer.basis);
assert.throws(()=>m.sceneWorldFromNative(lostConsumer,input.scene_reading,()=>{throw Error('unqualified source');}),/nine qualified planetary material voices/,'Available metadata/derivation must not conceal a missing actual native receiving mode.');
assert.ok(plan.definitions.length<=64,'The actual plan must fit the native profile owner before any CAS mutation.');
const reusableDefinitions=plan.definitions.filter(d=>d.profile.profile_ref.startsWith('profile:epi-world-'));
for(const definition of reusableDefinitions){
 const defaults=definition.profile.material_defaults??{};
 const reusable=defaults.material?.value;
 if(reusable){
  for(const key of ['id','position','role','overrides','sound'])assert.equal(Object.hasOwn(reusable,key),false,`Occasion ${key} cannot be stored in immutable reusable material.`);
  for(const step of reusable.sequence?.steps??[])assert.match(step.id,/^material-step-\d+$/);
  if(reusable.native)assert.equal(Object.hasOwn(reusable.native,'id'),false);
 }
}
let reusablePersonOccasionProof='not executed: a second actual native producer input is required';
if(config.reused_input_file){
 const otherInput=JSON.parse(await readFile(config.reused_input_file,'utf8'));
 assert.notEqual(otherInput.document.expression_ref,input.document.expression_ref,'Use another actual native instance, not the opening fixture twice.');
 assert.notEqual(otherInput.personal.person.ref,input.personal.person.ref,'Use an independently controlled second person.');
 const other=m.buildEpiWorldMaterial(otherInput),byRef=new Map(other.definitions.map(d=>[d.profile.profile_ref,d.profile]));
 let common=0;for(const d of plan.definitions){const existing=byRef.get(d.profile.profile_ref);if(existing){assert.deepEqual(existing,d.profile,'Same immutable grammar ref differs for another real person/occasion.');common++;}}
 assert.ok(common>=reusableDefinitions.length-2,'A second person must reuse the shared grammar; only exact current-form purpose variations may differ.');
 reusablePersonOccasionProof=`${common} actual immutable profile definitions reused unchanged across independent controlled person/instance inputs`;
}
const wrongProcess=structuredClone(input);wrongProcess.form_material.subject_ref='ql:scene-form:expression:controlled-other';
assert.throws(()=>m.buildEpiWorldMaterial(wrongProcess),/instance-owned native process subject/,'The same glyph cannot silently borrow another person\'s form process.');
/** Compare actual owner resolution with the nearest explicit definition for
 * each key. This deliberately does not call the browser's lineage resolver.
 * It also challenges form/source expectations independently of role labels. */
function verifyOwnerInheritance(rows,document){
 const actual=new Map(rows.map(row=>[row.data.profile.profile_ref,row]));
 assert.equal(actual.size,plan.definitions.length,'Every admitted profile needs its actual native resolution receipt.');
 const lineages=[],materialChecks=[];
 for(const request of plan.definitions){
  const ref=request.profile.profile_ref,row=actual.get(ref);assert.ok(row,`Actual native profile ${ref} is absent.`);
  assert.deepEqual(row.data.profile,request.profile,'The owner profile content differs from the retained immutable definition.');
  assert.ok(row.data.resolved_defaults&&typeof row.data.resolved_defaults==='object','The actual native profile reply omitted resolved_defaults.');
  const chain=[],seen=new Set();let cursor=ref;
  while(cursor){
   assert.ok(!seen.has(cursor)&&chain.length<=8,'Native profile lineage is circular or unbounded.');seen.add(cursor);
   const parent=actual.get(cursor);assert.ok(parent,'Actual first-parent profile receipt is absent.');chain.push(parent.data.profile);
   cursor=parent.data.profile.parent_profile_refs[0]??null;
  }
  const keys=new Set(chain.flatMap(p=>Object.keys(p.material_defaults??{})));
  assert.deepEqual(Object.keys(row.data.resolved_defaults).sort(),[...keys].sort(),'Native resolution lost or invented an inherited parameter key.');
  for(const key of keys){
   const nearest=chain.find(p=>Object.hasOwn(p.material_defaults??{},key));
   assert.deepEqual(row.data.resolved_defaults[key],nearest.material_defaults[key],`Native key replacement differs for ${key}; material is one whole value.`);
  }
  lineages.push({profile_ref:ref,owner_evidence:row.evidence,chain:chain.map(p=>p.profile_ref),resolved_keys:[...keys].sort()});
 }
 const expectedGlyphs={Sun:'☉',Moon:'☽',Mercury:'☿',Venus:'♀',Mars:'♂',Jupiter:'♃',Saturn:'♄',Uranus:'♅',Neptune:'♆',Pluto:'♇'};
 const expectedCentres=['muladhara','svadhisthana','manipura','anahata','vishuddha','ajna','sahasrara'];
 for(const occurrence of plan.occurrences){
  const row=actual.get(occurrence.profile_ref),material=row.data.resolved_defaults.material?.value;
  assert.ok(material&&typeof material==='object'&&Object.keys(material).length,'Native purpose profile resolved no expressive material.');
  const lineage=lineages.find(l=>l.profile_ref===occurrence.profile_ref);assert.equal(lineage.chain.length,4,'Authored purpose must inherit actual branch, family and global definitions.');
  const global=actual.get(lineage.chain[3]).data.profile;assert.equal(global.parent_profile_refs.length,0);
  assert.equal(row.data.resolved_defaults.glyph?.value,'∴','Global authored glyph was lost in native inheritance.');
  // A scalar branch shape is independent of the whole rich body material.
  // Native key replacement must preserve the latter as the exact leaf value.
  assert.deepEqual(material,row.data.profile.material_defaults.material.value,'Rich material must be the complete explicit purpose value, not a nested merge of scalar defaults.');
  assert.equal(Object.hasOwn(material,'glyph'),false,'An inherited scalar glyph must not be merged into rich body material.');
  const entity=document.entities[occurrence.material.id];assert.ok(entity);
  const scene=document.scenes.find(s=>s.presentation?.scene?.entities?.some(e=>e.id===entity.entity_ref));
  const received=scene.presentation.scene.entities.find(e=>e.id===entity.entity_ref);
  for(const key of ['name','shape','text','size','tint','tintWeight','force','station'])assert.deepEqual(received[key],material[key],`Saved receiving material differs from actual native resolved ${key}.`);
  if(Object.hasOwn(expectedGlyphs,entity.title)){assert.equal(material.shape,'text');assert.equal(material.text,expectedGlyphs[entity.title]);}
  const centre=/^ql:m-coordinate:bimba:M2-5-0\/1-([1-7])$/.exec(entity.subject?.subject_ref??'');
  if(centre){const ordinal=Number(centre[1])-1;assert.equal(material.shape,'yantra');assert.equal(material.yantraId,expectedCentres[ordinal]);assert.equal(material.native.chakraId,expectedCentres[ordinal]);assert.equal(material.station,null);}
  if(entity.subject?.subject_ref===ownerWorld.current_form.process_subject_ref&&entity.title==='Current M3 form'){assert.equal(material.text,ownerWorld.current_form.hexagram_glyph);assert.equal(material.shape,'text');}
  if(material.source?.kind==='image'){assert.equal(material.source.image.mode,'luminance');assert.match(material.source.image.dataUrl,/^data:image\/png;base64,/);}
  materialChecks.push({entity_ref:entity.entity_ref,subject_ref:entity.subject.subject_ref,profile_ref:row.data.profile.profile_ref,owner_evidence:row.evidence,shape:material.shape,text:material.text,rich_material_exact:true});
 }
 const overridden=lineages.filter(l=>{const row=actual.get(l.profile_ref);return row.data.resolved_defaults.shape?.value==='ring'&&l.chain.some(ref=>actual.get(ref).data.profile.material_defaults.shape?.value==='glyph');});
 assert.ok(overridden.length,'The actual native branch ring must replace its inherited global scalar glyph shape.');
 return{standing:'actual admitted native profile replies and saved native receiving material; source/readback proof, not a new native mutation or installed rendering claim',profile_count:actual.size,purpose_material_count:materialChecks.length,key_replacement_discriminators:overridden.map(l=>l.profile_ref),lineages,material_checks:materialChecks,limits:['All delivered actual profiles have at most one parent; conflicting secondary-parent admission was not executed','No delivered ancestor defines rich material; conflicting nested parent/child material admission was not executed','Current61-of64 cache limit remains; future distinct opening-codon lifecycle needs native owner repair']};
}
if(config.mode==='offline-inheritance'){
 assert.ok(path.isAbsolute(config.native_receipt_dir),'Supply retained actual native receipt directory.');
 const prior=JSON.parse(await readFile(config.native_receipt_dir+'/native-world-material-receipt.json','utf8'));
 const rows=[];
 for(const operation of prior.operations.filter(o=>o.op==='expression'&&['profile_define','profile_inspect'].includes(o.operation)&&o.ok)){
  const evidencePath=config.native_receipt_dir+'/'+operation.evidence,bytes=await readFile(evidencePath),receipt=JSON.parse(bytes),data=receipt.response.outcome.data;
  assert.equal(receipt.response.ok,true);assert.equal(data.state,'profile');
  rows.push({data,evidence:evidencePath,sha256:createHash('sha256').update(bytes).digest('hex')});
 }
 const document=JSON.parse(await readFile(config.native_receipt_dir+'/native-world-material-readback.json','utf8'));
 const proof=verifyOwnerInheritance(rows,document);
 const broken=structuredClone(rows),purpose=broken.find(r=>r.data.profile.material_defaults.material);purpose.data.resolved_defaults.material.value.glyph='∴';
 assert.throws(()=>verifyOwnerInheritance(broken,document),/Native key replacement|complete explicit purpose|inherited scalar glyph/,'Available profile metadata cannot conceal a wrong nested material merge.');
 const missing=structuredClone(rows);delete missing.find(r=>r.data.profile.material_defaults.material).data.resolved_defaults.material;
 assert.throws(()=>verifyOwnerInheritance(missing,document),/lost or invented|no expressive material/,'A defined profile without its actual resolved material must fail.');
 proof.verifier_discriminators=['Incorrect nested material merge refused with profile/source metadata retained','Resolved purpose material removed while profile remains defined refused'];
 proof.owner_receipts=rows.map(r=>({evidence:r.evidence,sha256:r.sha256,profile_ref:r.data.profile.profile_ref}));
 await writeFile(config.output+'/native-profile-inheritance-proof.json',JSON.stringify(proof,null,2)+'\n');
 console.log(JSON.stringify({standing:proof.standing,profile_count:proof.profile_count,purpose_material_count:proof.purpose_material_count,verifier_discriminators:proof.verifier_discriminators,limits:proof.limits},null,2));
 process.exit(0);
}
const nativeOp=async (op,request)=>{
 const response=await fetch(config.bridge+'/op',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op,request}),signal:AbortSignal.timeout(90000)});
 const reply=await response.json();operations.push({op,operation:request.operation??(request.inventory?'source-inventory':'source-content'),...(request.expression_ref?{expression_ref:request.expression_ref}:{}),ok:!reply.error});
 const evidence=`operation-${String(operations.length).padStart(3,'0')}-${op}-${request.operation??'coordinate'}.json`;
 await writeFile(config.output+'/'+evidence,JSON.stringify({request:{op,request},response:reply},null,2)+'\n');operations.at(-1).evidence=evidence;
 if(reply.error||!reply.outcome?.data)throw Error(reply.error??'The native Expression owner returned no readback.');return reply.outcome.data;
};
const native=request=>nativeOp('expression',request);
// Independent current source owner supplies the actual field count/revision,
// rather than accepting a producer's own repeated count as a coverage proof.
const actualInventory=await nativeOp('nara_coordinate',{coordinate_ref:'#4.4.4.4',face:'bimba',source_only:true,inventory:{offset:0,limit:1}});
assert.equal(actualInventory.schema,'ql.bimba-inventory/v1');assert.equal(input.inventory.length,actualInventory.total);
assert.equal(input.inventory_receipt.relation_count,actualInventory.relations);assert.equal(input.inventory_receipt.source_revision,actualInventory.source_revision);
assert.equal(input.locus.reading.binding.rooted_world.registry_revision,actualInventory.registry_revision);
const actualLocus=await nativeOp('nara_coordinate',{coordinate_ref:'#4.4.4.4',face:'bimba',source_only:true});
assert.equal(actualLocus.schema,'ql.bimba-coordinate-content/v1');assert.equal(actualLocus.identity.uuid,'dcb274c1-fbbc-5914-b27d-dea979c78558');
assert.equal(actualLocus.identity.coordinate,'M4.4.4.4');assert.equal(actualLocus.identity.properties_sha256,input.locus.identity.properties_sha256);
assert.equal(actualLocus.source_revision,actualInventory.source_revision);
const before=(await native({operation:'inspect',expression_ref:input.document.expression_ref})).document;
const actualProfiles=[];
if(config.mode==='construct'){
 assert.deepEqual(before,input.document,'The real native CAS basis changed before construction.');
 for(const request of plan.definitions){
  const ref=request.profile.profile_ref;let stored;
  try{stored=await native({operation:'profile_inspect',profile_ref:ref});}
  catch(error){if(!String(error).includes('Profile is not defined'))throw error;}
  if(stored)assert.deepEqual(stored.profile,request.profile,'Immutable native profile content differs from the plan.');else stored=await native(request);
  actualProfiles.push({data:stored,evidence:operations.at(-1).evidence});
 }
 await native(plan.edit);
}
if(config.mode==='verify')for(const request of plan.definitions){const data=await native({operation:'profile_inspect',profile_ref:request.profile.profile_ref});actualProfiles.push({data,evidence:operations.at(-1).evidence});}
const document=(await native({operation:'inspect',expression_ref:input.document.expression_ref})).document;
const view=m.verifyEpiWorldReadback(document,plan);
const inheritanceProof=verifyOwnerInheritance(actualProfiles,document);
await writeFile(config.output+'/native-profile-inheritance-proof.json',JSON.stringify(inheritanceProof,null,2)+'\n');
const unchanged=m.rebindEpiPersonalSubjects({document,receiving:plan.receiving,previous:input.personal,next:input.personal,actor:input.actor});
assert.equal(unchanged.edit.changes.length,15);
assert.ok(unchanged.edit.changes.every(c=>c.change==='subject_bind'),'Personal binding must not reconstruct material, profiles or journey.');
for(const change of unchanged.edit.changes)assert.deepEqual(change.binding,document.entities[change.entity_ref].subject,'Rebinding the same actual source is semantically idempotent.');
const wrongPerson=structuredClone(input.personal);wrongPerson.person.ref='person:controlled-other-binding';
assert.throws(()=>m.rebindEpiPersonalSubjects({document,receiving:plan.receiving,previous:input.personal,next:wrongPerson,actor:input.actor}),/retain the actual person/);
const wrongLocusBinding=structuredClone(document);wrongLocusBinding.entities[plan.receiving.personal.locus_entity_ref].subject.subject_ref='ql:m-coordinate:bimba:M4.4.4.3';
assert.throws(()=>m.rebindEpiPersonalSubjects({document:wrongLocusBinding,receiving:plan.receiving,previous:input.personal,next:input.personal,actor:input.actor}),/same-labelled wrong branch/);
const cosmic=plan.scenes.find(s=>s.id===plan.receiving.scene_ref),readbackScene=document.scenes.find(s=>s.scene_ref===cosmic.id);
assert.equal(cosmic.entities.length,32);assert.equal(readbackScene.entity_refs.length,32);
const cosmicView=view.journey.scenes.find(s=>view.bindings[s.id].scene_ref===cosmic.id),nativeConfig=m.toNativeConfig(cosmicView);
assert.equal(nativeConfig.entities.length,32,'The real receiving engine configuration must retain every rest-scene formation.');
const sourceImages=nativeConfig.entities.filter(e=>e.authoringSource?.kind==='image');assert.equal(sourceImages.length,6);
for(const e of sourceImages)assert.match(e.authoringSource.image.dataUrl,/^data:image\/png;base64,/);
// These source requirements are independent of the producer's role mapping.
const requiredNames=['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'];
for(const name of requiredNames){const actual=readbackScene.entity_refs.map(ref=>document.entities[ref]).filter(e=>e.title===name);assert.equal(actual.length,1,`The native cosmic field must contain one ${name}.`);}
const centreSubjects=Array.from({length:7},(_,i)=>`ql:m-coordinate:bimba:M2-5-0/1-${i+1}`);
for(const ref of centreSubjects)assert.equal(readbackScene.entity_refs.filter(id=>document.entities[id].subject?.subject_ref===ref).length,1);
assert.equal(plan.source_basis.registry_revision,input.locus.reading.binding.rooted_world.registry_revision);
assert.equal(plan.source_basis.numerical_registry_revision,input.scene.sources.registry_revision);
assert.equal(plan.source_basis.numerical_source_revision,input.inventory_receipt.source_revision);
for(const ref of centreSubjects){
 const subject=readbackScene.entity_refs.map(id=>document.entities[id].subject).find(s=>s?.subject_ref===ref);
 assert.ok(subject.sources.some(s=>s.ref===ref&&s.revision===input.scene.sources.registry_revision&&s.availability==='available'),'The actual native evidence consumer requires its admitted numerical body source stamp.');
 assert.ok(subject.sources.some(s=>s.revision===input.locus.reading.binding.rooted_world.registry_revision),'The current canonical coordinate basis must remain alongside numerical admission.');
}
assert.equal(document.entities[plan.receiving.personal.locus_entity_ref].subject.subject_ref,'ql:m-coordinate:bimba:M4.4.4.4');
for(const e of cosmic.entities.filter(e=>e.native?.chakraId)){
 assert.equal(e.station,null,'Canonical chakra identity cannot be a cymatic station index.');
 assert.equal(e.shape,'yantra');assert.equal(e.yantraId,e.native.chakraId);
 const actual=nativeConfig.entities.find(n=>n.chakraId===e.native.chakraId);assert.equal(actual.shape.kind,'yantra');assert.equal(actual.shape.yantraId,e.native.chakraId);
}
const crown=cosmic.entities.find(e=>e.native?.chakraId==='sahasrara'),ajna=cosmic.entities.find(e=>e.native?.chakraId==='ajna');
assert.notEqual(crown.text,'ॐ','Actual crown silence must not be replaced with the adjacent centre mantra.');assert.equal(ajna.text,'ॐ');
const formOccurrence=plan.occurrences.find(o=>o.purpose==='form');
assert.equal(document.entities[formOccurrence.material.id].subject.subject_ref,input.form_material.subject_ref);
assert.ok(document.entities[formOccurrence.material.id].subject.sources.some(s=>s.ref===input.form_material.reading.ref&&s.revision===input.form_material.reading.revision));
const hingeOccurrence=plan.occurrences.find(o=>o.purpose==='form-hinge');assert.ok(hingeOccurrence);
assert.equal(hingeOccurrence.material.id,`${document.expression_ref}:entity:world-current-form-hinge`);
assert.equal(document.entities[hingeOccurrence.material.id].subject.subject_ref,input.form_material.subject_ref);
assert.notEqual(formOccurrence.material.id,hingeOccurrence.material.id,'A separate native geometry consumer must preserve the actual symbolic glyph.');
// Preserve all controls/profile/source metadata, remove only required material.
const missing=structuredClone(document),earth=plan.occurrences.find(o=>o.purpose==='earth').material.id;
const scene=missing.scenes.find(s=>s.scene_ref===cosmic.id);scene.presentation.scene.entities=scene.presentation.scene.entities.filter(e=>e.id!==earth);
assert.throws(()=>m.verifyEpiWorldReadback(missing,plan),/required expressive material/);
const wrong=structuredClone(document);wrong.entities[plan.receiving.personal.locus_entity_ref].subject.subject_ref='ql:m-coordinate:bimba:M4.4.4.3';
assert.throws(()=>m.verifyEpiWorldReadback(wrong,plan),/incorrectly bound|wrong same-labelled/);
assert.equal(plan.receiving.preserve_authored_entity_refs.length,31);
assert.equal(plan.receiving.torus.native_constituent,'#1-5-1');
assert.equal(plan.dispositions.length,input.inventory_receipt.node_count);
assert.ok(plan.dispositions.every(row=>row.route.standing==='prepared-route'));
assert.equal(document.reuse.states.personal,`${document.expression_ref}:scene:personal`);
assert.equal(document.reuse.states.branches,`${document.expression_ref}:scene:branches`);
const branchScene=document.scenes.find(s=>s.scene_ref===document.reuse.states.branches);
assert.equal(branchScene.entity_refs.length,7);
for(let index=0;index<6;index++)assert.equal(branchScene.entity_refs.filter(id=>document.entities[id].subject?.subject_ref===`ql:m-coordinate:bimba:M4.${index}`).length,1,'Every actual M4 branch has an explicit source-bound entrance.');
const personalScene=document.scenes.find(s=>s.scene_ref===document.reuse.states.personal);
assert.equal(personalScene.entity_refs.length,9);
for(const ref of centreSubjects)assert.equal(personalScene.entity_refs.filter(id=>document.entities[id].subject?.subject_ref===ref).length,1);
let personalConsumerProof='not executed: provide actual protected identity_file and current_file to test native personal reception';
if(config.identity_file||config.current_file){
 assert.ok(config.identity_file&&config.current_file,'The consumer replay needs both actual protected owner readings.');
 const identity=JSON.parse(await readFile(config.identity_file,'utf8')),current=JSON.parse(await readFile(config.current_file,'utf8'));
 assert.equal(identity.reading.person_ref,input.personal.person.ref);assert.equal(identity.source.source_ref,input.personal.identity.ref);assert.equal(identity.source.revision,input.personal.identity.revision);
 assert.equal(current.schema,'oi.nara-personal-current-context/v1');assert.equal(current.status,'available');assert.equal(current.expression_ref,document.expression_ref);
 assert.equal(current.context.event_ref,input.event.event_ref);assert.equal(current.reading.transit.sky.snapshot_ref,input.scene.snapshot_ref);
 const sceneId=Object.entries(view.bindings).find(([,b])=>b.scene_ref===personalScene.scene_ref)[0];
 const presentation={identity,channel:'direct-planetary-resonance',waves:true,sound:true,current};
 const field=m.createEvidenceField(presentation,view,sceneId);
 assert.equal(field.resonance.drivers.length,7);assert.equal(field.expressionRef,document.expression_ref);
 const selected=field.resonance.drivers[0],binding=view.bindings[sceneId].occurrences.find(o=>o.view_entity_id===selected.entityId),sourceRef=centreSubjects[0];
 // Preserve the current canonical coordinate/source and every control/body;
 // delete only the admitted numerical source stamp required by real consumer.
 const missingNumerical=structuredClone(document);missingNumerical.entities[binding.entity_ref].subject.sources=missingNumerical.entities[binding.entity_ref].subject.sources.filter(s=>!(s.ref===sourceRef&&s.revision===input.scene.sources.registry_revision));
 const missingView=m.kernelDocumentToJourney(missingNumerical);
 // verifyEpiWorldReadback deliberately rejects altered material, so perform
 // these independent receiving checks using the actual production loader.
 const missingSceneId=Object.entries(missingView.bindings).find(([,b])=>b.scene_ref===personalScene.scene_ref)[0];
 assert.throws(()=>m.createEvidenceField(presentation,missingView,missingSceneId),/current native body sources/);
 const wrongCentre=structuredClone(document);wrongCentre.entities[binding.entity_ref].subject.subject_ref=centreSubjects[1];
 const wrongView=m.kernelDocumentToJourney(wrongCentre),wrongSceneId=Object.entries(wrongView.bindings).find(([,b])=>b.scene_ref===personalScene.scene_ref)[0];
 assert.throws(()=>m.createEvidenceField(presentation,wrongView,wrongSceneId),/current native body sources/);
 personalConsumerProof='actual saved native identity/current + exact source-bound scene accepted by production createEvidenceField; removed numerical stamp and same-labelled wrong centre refused; rendered/tensor consumer effect remains separate';
}
const serialized=JSON.stringify(document);for(const key of ['q_identity','q_identity_transit','q_activity','q_composed','birth_time','natal_chart'])assert.equal(serialized.includes(`"${key}"`),false,`Protected ${key} cannot enter portable material.`);
const receipt={standing:'real-native-profile/CAS/material/production-loader proof; installed expressive and native consumer causal proofs required separately',module_sha256:createHash('sha256').update(await readFile(modulePath)).digest('hex'),expression_ref:document.expression_ref,revision:document.revision,scenes:document.scenes.map(s=>({scene_ref:s.scene_ref,entity_count:s.entity_refs.length})),source_basis:plan.source_basis,independent_current_inventory:{node_count:actualInventory.total,relation_count:actualInventory.relations,source_revision:actualInventory.source_revision,registry_revision:actualInventory.registry_revision},personal_reception_standing:plan.receiving.personal.standing,personal_consumer_proof:personalConsumerProof,checks:['Independent actual native inventory and personal-locus content qualify the complete producer input','Exact native profile definitions and single-CAS scene/subject/material construction','32 named source-bound cosmic occurrences survive production loader','All ten sky bodies and exact seven centre/locus source identities','Symbolic form glyph and native hinge retain distinct receiving bodies for the same actual native process','Body-material removal fails while controls/profiles remain','Same-labelled wrong personal coordinate fails','Receiving declaration binds the exact torus constituent and protects31 other bodies; actual target-consumer effect requires separate proof','Full actual inventory has explicit prepared source/material disposition','Protected personal values absent from portable native material','Personal and six-branch Scenes retain shared source occurrences and world instance'],operations};
receipt.profile_definitions=plan.definitions.length;
receipt.reusable_person_occasion_proof=reusablePersonOccasionProof;
let correctionProof='not executed: a later actual native PersonalInstance is required';
if(config.corrected_personal_file){
 const next=JSON.parse(await readFile(config.corrected_personal_file,'utf8'));
 assert.notDeepEqual(next.identity,input.personal.identity,'A correction proof requires an actual later native identity source, not the opening identity twice.');
 const correction=m.rebindEpiPersonalSubjects({document,receiving:plan.receiving,previous:input.personal,next,actor:input.actor});
 await native(correction.edit);
 const corrected=(await native({operation:'inspect',expression_ref:document.expression_ref})).document;
 assert.equal(corrected.expression_ref,document.expression_ref);assert.equal(corrected.revision,document.revision+1);
 assert.deepEqual(corrected.scenes,document.scenes,'Native correction must retain material, scene order and any later journey/deck scene.');
 for(const key of ['selection','reuse','profiles','collections','relations','presentation'])assert.deepEqual(corrected[key],document[key],`Correction changed continuing ${key}.`);
 const participants=new Set(plan.receiving.personal.participant_entity_refs);
 for(const [ref,entity] of Object.entries(document.entities)){
  const actual=corrected.entities[ref];assert.equal(actual.title,entity.title);assert.deepEqual(actual.parameters,entity.parameters);
  if(!participants.has(ref))assert.deepEqual(actual,entity,'An unrelated cosmic/journey subject changed during personal correction.');
  else{
   assert.equal(actual.subject.subject_ref,entity.subject.subject_ref,'Personal correction must not relabel canonical subjects.');
   assert.ok(actual.subject.sources.some(s=>s.ref===next.identity.ref&&s.revision===next.identity.revision&&s.availability==='available'));
   assert.ok(actual.subject.sources.some(s=>s.ref===next.person.ref&&s.revision===next.person.revision&&s.availability==='available'));
   if(next.current)assert.ok(actual.subject.readings.some(s=>s.ref===next.current.ref&&s.revision===next.current.revision&&s.availability==='available'));
   for(const source of entity.subject.sources.filter(s=>s.ref.startsWith('ql:m-coordinate:')))assert.ok(actual.subject.sources.some(s=>JSON.stringify(s)===JSON.stringify(source)),'Canonical and native numerical source receipts must survive correction.');
  }
 }
 const correctedView=m.kernelDocumentToJourney(corrected);assert.equal(correctedView.journey.scenes.length,view.journey.scenes.length);
 await writeFile(config.output+'/native-world-corrected-person-readback.json',JSON.stringify(corrected,null,2)+'\n');
 correctionProof='actual later native identity/current rebound by subject-only native CAS; same Expression, all scenes/material/deck, canonical and numerical receipts preserved';
}
receipt.personal_correction_proof=correctionProof;
await writeFile(config.output+'/native-world-material-readback.json',JSON.stringify(document,null,2)+'\n');
await writeFile(config.output+'/native-world-material-plan.json',JSON.stringify(plan,null,2)+'\n');
await writeFile(config.output+'/native-world-production-loader-readback.json',JSON.stringify(view,null,2)+'\n');
await writeFile(config.output+'/native-world-material-receipt.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt,null,2));
