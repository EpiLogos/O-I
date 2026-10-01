#!/usr/bin/env node
/** Actual kernel/QL/Central receiving proof for an existing controlled world.
 * Config: bridge, project, binding (the real saved identity/person/Nara/world),
 * original_source (the complete independently retained original Bimba read),
 * output (the current authorised NOW/T). No provider or fake owner is started.
 * Native focus and two negative subject edits are restored on the same native
 * controlled world. This is native selection/source/bounded-turn proof; real
 * fresh-body/installed encounter acceptance remains a separate proof.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
if(!process.argv[2])throw Error('Supply the actual native world context configuration.');
const config=JSON.parse(await readFile(process.argv[2],'utf8'));
assert.match(config.bridge,/^http:\/\/127\.0\.0\.1:\d+$/);
assert.match(config.binding.expression_ref,/^expression:(controlled-|epi-)/);
assert.match(config.binding.person_ref,/^(controlled:|person:controlled)/);
assert.ok(config.output.includes('/Control/agents/now/clearings/')&&config.output.includes('/T/'));
await mkdir(config.output,{recursive:true});
const original=JSON.parse(await readFile(config.original_source,'utf8'));
const graph=original.content??original;
assert.equal(Object.keys(graph.nodes).length,2141);assert.equal(graph.relations.length,11810);
const rawSun=graph.nodes['M2-5-(0/1)'];assert.equal(rawSun.properties.c_1_name,'Sun');
assert.equal(graph.nodes['M4.4.4.4'].properties.c_2_uuid,'dcb274c1-fbbc-5914-b27d-dea979c78558');
const ops=[],checks=[];
async function native(op,request){
 const response=await fetch(config.bridge+'/op',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op,...(['nara_dialogue','nara_epii'].includes(op)?{project:config.project}:{}),request}),signal:AbortSignal.timeout(90000)});
 const reply=await response.json();ops.push({op,operation:request.operation,error:reply.error??null});
 if(reply.error||!reply.outcome?.data)throw Error(reply.error??'No native receiving data.');return reply.outcome.data;
}
const inspect=async()=> (await native('expression',{operation:'inspect',expression_ref:config.binding.expression_ref})).document;
const initial=await inspect(),originalSelection=structuredClone(initial.selection);
const hub=initial.profiles.filter(p=>p.profile_ref.startsWith('profile:epi-coordinate-'));
assert.equal(hub.length,1,'The native containing profile must be unambiguous.');
assert.equal(hub[0].source_basis.ref,'ql:m-coordinate:bimba:M4.4.4.4');
const originalProfiles=structuredClone(initial.profiles),originalSubjects=Object.fromEntries(Object.entries(initial.entities).map(([ref,e])=>[ref,structuredClone(e.subject)]));
const sunEntity=Object.values(initial.entities).find(e=>e.subject?.subject_ref==='ql:m-coordinate:bimba:M2-5-0/1');
assert.ok(sunEntity,'The exact source Sun must exist as an actual native subject, not merely a label.');
const form=Object.values(initial.entities).find(e=>e.entity_ref.endsWith(':entity:world-current-form'));
assert.ok(form);assert.equal(form.subject.subject_ref,'ql:scene-form:'+initial.expression_ref);
const sceneFor=ref=>initial.scenes.find(s=>s.entity_refs?.includes(ref))?.scene_ref;
async function focus(ref){const doc=await inspect();const scene=sceneFor(ref);assert.ok(scene);await native('expression',{operation:'edit',expression_ref:doc.expression_ref,expected_revision:doc.revision,actor:'agent:epi-native-context-verification',changes:[{change:'focus',scene_ref:scene,entity_ref:ref}]});}
async function bind(ref,subject){const doc=await inspect();await native('expression',{operation:'edit',expression_ref:doc.expression_ref,expected_revision:doc.revision,actor:'agent:epi-native-context-negative',changes:[{change:'subject_bind',entity_ref:ref,binding:subject}]});}
const request={...config.binding,role:'nara',operation:'context'};
let server, failure;
try{
 await focus(sunEntity.entity_ref);
 const sun=await native('nara_dialogue',request);
 assert.equal(sun.context.coordinate_ref,'M2-5-0/1');assert.equal(sun.context.active_m_focus,'m2');
 assert.equal(sun.context.profile_ref,hub[0].profile_ref);assert.equal(sun.profile.profile_ref,hub[0].profile_ref);
 assert.equal(sun.containing_coordinate_binding.coordinate_ref,'#4.4.4.4');
 assert.equal(sun.context.pointed_ref,sunEntity.subject.subject_ref);
 assert.equal(sun.selected_source_content.identity.uuid,rawSun.properties.c_2_uuid);
 assert.deepEqual(sun.selected_source_content.identity.properties,rawSun.properties);
 assert.equal(sun.world.registry_revision,sun.containing_coordinate_binding.rooted_world.registry_revision);
 assert.equal(sun.context.subject_ref,config.binding.person_ref);
 checks.push('Actual selected Sun context/source/focus differs from containing exact Personal Pratibimba profile while same person/world/registry remain.');
 const wrongOwner=structuredClone(sunEntity.subject);wrongOwner.native_owner='expressions';
 await bind(sunEntity.entity_ref,wrongOwner);
 await assert.rejects(()=>native('nara_dialogue',request),/different native owner/);
 await bind(sunEntity.entity_ref,originalSubjects[sunEntity.entity_ref]);
 checks.push('Actual selected same-coordinate body with wrong native owner is refused, then original binding restored.');
 const locus=Object.values(initial.entities).find(e=>e.subject?.subject_ref==='ql:m-coordinate:bimba:M4.4.4.4');
 assert.ok(locus,'The canonical Personal Pratibimba must be an actual selected native subject.');
 await focus(locus.entity_ref);
 const personal=await native('nara_dialogue',request);
 assert.equal(personal.context.coordinate_ref,'M4.4.4.4');assert.equal(personal.context.active_m_focus,'m4');
 assert.equal(personal.context.pointed_ref,locus.subject.subject_ref);
 assert.equal(personal.context.subject_ref,config.binding.person_ref);
 assert.equal(personal.context.profile_ref,hub[0].profile_ref);
 assert.equal(personal.selected_source_content.identity.uuid,graph.nodes['M4.4.4.4'].properties.c_2_uuid);
 // The actual native Epii owner prepares its bounded inquiry from this same
 // qualified selected source, rather than substituting a prewritten answer or
 // claiming that coordinate property keys contain their values. No model/body
 // is launched by this source-envelope test; fresh-body proof is separate.
 const brief='What does this selected locus make possible in the containing field, and which source relations support your reading?';
 const delegated=await native('nara_epii',{operation:'delegate',binding:{...request,role:'epii'},brief});
 assert.equal(delegated.schema,'oi.nara-epii-delegation/v1');assert.equal(delegated.submitted,false);
 await writeFile(config.output+'/native-epii-selected-source-envelope.json',JSON.stringify({standing:'Actual native source-envelope preparation; no body launched or completed answer claimed',prepared:delegated},null,2));
 const turn=JSON.parse(delegated.text);
 assert.equal(turn.question,brief);assert.equal(turn.role,'epii');
 assert.deepEqual(turn.containing_coordinate_binding,personal.containing_coordinate_binding);
 assert.deepEqual(turn.selected_source_relation,personal.selected_source_relation);
 assert.deepEqual(turn.selected_scene_native_basis,personal.selected_scene_native_basis);
 assert.equal(turn.selected_source_basis.source_revision,personal.selected_source_content.source_revision);
 assert.equal(turn.selected_source_basis.registry_revision,personal.selected_source_content.registry_revision);
 assert.equal(turn.selected_source_basis.identity.uuid,graph.nodes['M4.4.4.4'].properties.c_2_uuid);
 assert.equal(turn.selected_source_basis.relation_count,personal.selected_source_content.relations.length);
 if(Buffer.byteLength(JSON.stringify(personal.selected_source_content))<=64*1024){
  assert.equal(turn.selected_source_basis.content_in_turn,'complete');
  assert.deepEqual(turn.selected_source_content,personal.selected_source_content);
 }else{
  assert.equal(turn.selected_source_basis.content_in_turn,'native-source-entrance');
  assert.equal(turn.selected_source_content,null);
 }
 assert.ok(Buffer.byteLength(delegated.text)<=256*1024);
 checks.push('Actual native Epii inquiry carries the same selected complete source or explicitly bounded source entrance, containing binding, relation and scene/current basis; preparation is not a completed agent answer.');

 assert.deepEqual(personal.selected_source_content.identity.properties,graph.nodes['M4.4.4.4'].properties);
 checks.push('Actual canonical Personal Pratibimba selection resolves its original locus and M4 focus while retaining the particular person and containing world.');
 await focus(form.entity_ref);
 const current=await native('nara_dialogue',request);
 const world=initial.scenes.map(s=>s.presentation?.scene?.epiWorld).find(Boolean);assert.ok(world);
 const expected=(world.native_readback??world.world.native_readback).form_process.current_reading;
 assert.equal(current.context.coordinate_ref,expected.ref.replace(/^ql:m-coordinate:bimba:/,''));
 assert.equal(current.context.active_m_focus,'m3');
 assert.equal(current.context.pointed_ref,form.subject.subject_ref);
 assert.equal(current.context.profile_ref,hub[0].profile_ref);
 assert.ok(current.context.disclosed.some(r=>r.ref_id===expected.ref&&r.revision===expected.revision));
 assert.equal(current.selected_source_content.source_revision,expected.revision);
 const old=structuredClone(form.subject);const first=old.readings.find(r=>r.ref.startsWith('ql:m-coordinate:'));
 assert.ok(first);first.ref='ql:m-coordinate:bimba:M3-2-1-4-3'===first.ref?'ql:m-coordinate:bimba:M3-2-1-4-2':'ql:m-coordinate:bimba:M3-2-1-4-3';
 await bind(form.entity_ref,old);
 await assert.rejects(()=>native('nara_dialogue',request),/differs from its actual retained native process reading/);
 await bind(form.entity_ref,originalSubjects[form.entity_ref]);
 checks.push('Actual stable process resolves its currently qualified canonical form; valid but stale other-codon source is refused without repainting process/profile.');
 const relation=Object.values(initial.relations).find(r=>r.native_owner==='ql-mef'&&initial.entities[r.from_entity_ref]?.subject?.subject_ref.startsWith('ql:m-coordinate:')&&initial.entities[r.to_entity_ref]?.subject?.subject_ref.startsWith('ql:m-coordinate:'));
 if(!relation)throw Error('A real native source relation is required for this receiving proof.');
 let doc=await inspect();const relationScene=initial.scenes.find(s=>s.entity_refs?.includes(relation.from_entity_ref)&&s.entity_refs?.includes(relation.to_entity_ref));assert.ok(relationScene);
 await native('expression',{operation:'edit',expression_ref:doc.expression_ref,expected_revision:doc.revision,actor:'agent:epi-native-context-verification',changes:[{change:'relation_focus',scene_ref:relationScene.scene_ref,binding_ref:relation.binding_ref}]});
 const related=await native('nara_dialogue',request);
 assert.equal(related.context.pointed_ref,relation.relation.ref);
 const nativeRelation=related.selected_source_relation;assert.equal(nativeRelation.relation_ref,relation.relation.ref);
 const originalRelation=graph.relations.find(r=>r[0]===nativeRelation.from_coordinate&&r[1]===nativeRelation.kind&&r[2]===nativeRelation.to_coordinate);
 assert.ok(originalRelation);assert.deepEqual(nativeRelation.properties,originalRelation[3]);assert.equal(nativeRelation.orientation,'directed');
 for(const ref of [relation.from_entity_ref,relation.to_entity_ref])assert.ok(related.context.disclosed.some(r=>r.ref_id===initial.entities[ref].subject.subject_ref));
 checks.push('Actual directed native relation stays pointed while both exact endpoint sources are disclosed.');
 await focus(form.entity_ref);doc=await inspect();
 const context=await native('nara_dialogue',request);
 const savedIdentity=await native('nara_identity',{operation:'open',source_ref:config.binding.source_ref});
 server=await createServer({configFile:false,root:process.cwd(),cacheDir:config.output+'/vite-cache',server:{middlewareMode:true},ssr:{noExternal:[]}});
 const {selectCurrentIdentity,currentIdentity}=await server.ssrLoadModule('/src/nara/identity/current.ts');selectCurrentIdentity(savedIdentity.reading,savedIdentity.source);
 const {buildNativeTurnBasis,nativeTurnText}=await server.ssrLoadModule('/src/nara/nativeDialogue.ts');
 const basis=buildNativeTurnBasis(currentIdentity(),context.context.agent_session_ref,doc);
 Object.assign(basis,{context:context.context,coordinate_binding:context.coordinate_binding,containing_coordinate_binding:context.containing_coordinate_binding,selected_source_content:context.selected_source_content,selected_source_relation:context.selected_source_relation,selected_scene_native_basis:context.selected_scene_native_basis,personal_current_reading:context.personal_current_reading});
 const question='What source determines the currently selected form, and what remains fixed when I advance it?';
 const text=nativeTurnText(question,basis,'nara'),input=JSON.parse(text);
 assert.ok(new TextEncoder().encode(text).length<=256*1024,'Ordinary native world source/material must fit the real turn budget.');
 assert.equal(input.question,question);assert.equal(input.context.pointed_ref,form.subject.subject_ref);
 assert.equal(input.coordinate_binding.coordinate_id,context.coordinate_binding.coordinate_id);
 assert.equal(input.expression.scene.scene_ref,doc.selection.scene_ref);
 assert.equal(input.expression.scene.presentation,undefined);
 const rawBasis=input.selected_scene_native_basis,actual=(world.native_readback??world.world.native_readback);
 assert.equal(rawBasis.instance_ref,doc.expression_ref);assert.equal(rawBasis.person_ref,config.binding.person_ref);
 assert.equal(rawBasis.event_ref,world.world.event_ref);assert.equal(rawBasis.snapshot_ref,world.world.snapshot_ref);
 assert.deepEqual(rawBasis.current_readback.m1_clock,actual.m1_clock);
 assert.deepEqual(rawBasis.current_readback.continuous_clock,actual.continuous_clock);
 assert.deepEqual(rawBasis.current_readback.selected_aperture,actual.selected_aperture);
 assert.deepEqual(rawBasis.current_form_process.current_reading,actual.form_process.current_reading);
 assert.equal(rawBasis.source_basis.source_revision,original.source_revision??original.content_sha256);
 for(const key of ['inventory','register_members','targets','identity','native_current','personal_current','clock_semantics'])assert.equal(rawBasis[key],undefined);
 assert.equal(rawBasis.current_readback.clock_semantics,undefined);assert.equal(rawBasis.current_form_process.source_rule,undefined);
 assert.equal(input.selected_source_basis.identity.uuid,context.selected_source_content.identity.uuid);
 assert.ok(input.selected_source_basis.identity.full_source_ref);
 assert.equal(input.selected_source_content?.source_revision??context.selected_source_content.source_revision,context.selected_source_content.source_revision);
 assert.deepEqual(doc.profiles,originalProfiles);
 checks.push('Production nativeTurnText carries actual selected/containing/source/scene basis under256KB without copying world inventory/assets or supplying an expected answer; no provider/fresh-body result claimed.');
}catch(error){failure={name:error.name,message:error.message,stack:error.stack};throw error;}finally{
 for(const [ref,subject] of Object.entries(originalSubjects)){const doc=await inspect();if(JSON.stringify(doc.entities[ref]?.subject)!==JSON.stringify(subject))await bind(ref,subject);}
 const doc=await inspect();const changes=originalSelection.relation_ref?[{change:'relation_focus',scene_ref:originalSelection.scene_ref,binding_ref:originalSelection.relation_ref}]:[{change:'focus',scene_ref:originalSelection.scene_ref,entity_ref:originalSelection.entity_ref}];
 await native('expression',{operation:'edit',expression_ref:doc.expression_ref,expected_revision:doc.revision,actor:'agent:epi-native-context-return',changes});
 if(server)await server.close();
 if(failure)await writeFile(config.output+'/native-context-failure.json',JSON.stringify({passed:false,failure,checks,operations:ops,expression_ref:initial.expression_ref},null,2));
}
const restored=await inspect();assert.deepEqual(restored.selection,originalSelection);assert.deepEqual(restored.profiles,originalProfiles);
for(const [ref,subject] of Object.entries(originalSubjects))assert.deepEqual(restored.entities[ref].subject,subject);
const sourceFiles=['kernel/src/nara_dialogue.rs','kernel/src/nara_epii.rs','kernel/src/nara_world_readiness.rs','src/nara/nativeDialogue.ts','tests/nara-world-context-native.mjs'];
const receipt={schema:'oi.nara-world-context-native-receipt/v1',standing:'actual native selection/source and production turn-shaping proof; no provider/fresh-body, rendered or installed acceptance',passed:true,checks,operations:ops,expression_ref:initial.expression_ref,original_selection:originalSelection,restored_revision:restored.revision,source_files:Object.fromEntries(await Promise.all(sourceFiles.map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])))};
await writeFile(config.output+'/native-context-receipt.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify({passed:true,checks:checks.length,receipt:config.output+'/native-context-receipt.json'}));
