#!/usr/bin/env node
/** Actual saved identity -> native coordinate owner -> production preparation ->
 * one native Expression CAS. No invented identities, profile values or sources.
 * node tests/nara-personal-body-native.mjs <controlled-native-config.json>
 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createServer} from 'vite';
import {closeControlledExpression} from './nara-native-cleanup.mjs';
const config=JSON.parse(await readFile(process.argv[2],'utf8'));
assert.match(config.bridge,/^http:\/\/127\.0\.0\.1:\d+$/);assert.match(config.binding.person_ref,/^controlled:/);
assert.ok(config.world.includes('/Control/agents/now/clearings/')&&config.world.includes('/T/')&&config.world.endsWith('/world'));
const output=path.join(path.dirname(process.argv[2]),'nara-personal-body-native');await mkdir(output,{recursive:true});
const native=async request=>{
 const response=await fetch(`${config.bridge}/op`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(90000)});
 const result=await response.json();if(result.error)throw Error(result.error);assert.ok(result.outcome);return result.outcome.data;
};
const server=await createServer({configFile:false,root:process.cwd(),cacheDir:path.join(output,'vite-cache'),server:{middlewareMode:true},optimizeDeps:{noDiscovery:true,include:[]}});
const checks=[],sources={};let expression_ref,created=false,passed=false;
try{
 const {preparePersonalBodyBindings}=await server.ssrLoadModule('/expressions-app/field-studies-journeys/src/naraPersonalBody.ts');
 for(const file of ['expressions-app/field-studies-journeys/src/naraPersonalBody.ts','src/nara/coordinateExpression.ts','expressions-app/src/engine/semantics/chakraSemantics.ts'])sources[file]=createHash('sha256').update(await readFile(file)).digest('hex');
 const identity=await native({op:'nara_identity',request:{operation:'open',source_ref:config.binding.source_ref}});
 assert.equal(identity.reading.person_ref,config.binding.person_ref);
 const calculated=await native({op:'nara_identity',request:{operation:'calculate',profile:identity.reading.profile}});
 assert.equal(calculated.reading.input_revision,identity.reading.input_revision);assert.equal(calculated.reading.person_ref,identity.reading.person_ref);
 assert.ok(calculated.reading.natal_composition?.centre_evidence,'The actual saved profile must yield native calculated body evidence');
 const source=await native({op:'expression',request:{operation:'inspect',expression_ref:config.binding.expression_ref}});
 expression_ref=`expression:personal-body-${randomUUID()}`;
 const fork=await native({op:'expression',request:{operation:'fork',expression_ref:source.document.expression_ref,expected_revision:source.document.revision,new_expression_ref:expression_ref,actor:'agent:nara-native-verification'}});
 created=true;
 const document=fork.document,scene=document.scenes.find(value=>value.scene_ref===document.selection.scene_ref);assert.ok(scene);
 const template_bindings=scene.presentation.scene.entities.filter(value=>value.native?.chakraId).map(value=>({entity_ref:value.id,chakraId:value.native.chakraId}));
 const input={document,scene_ref:scene.scene_ref,centre_evidence:calculated.reading.natal_composition.centre_evidence,template_bindings};
 const read=request=>native({op:'nara_coordinate',request});
 const changed=structuredClone(input);changed.template_bindings[0].chakraId=changed.template_bindings[1].chakraId;
 await assert.rejects(()=>preparePersonalBodyBindings(read,changed),/exactly once|declared template/);
 const stale=structuredClone(input);stale.centre_evidence[0].body.body_zone.registry_revision+='-stale';
 await assert.rejects(()=>preparePersonalBodyBindings(read,stale),/source changed/);
 assert.deepEqual((await native({op:'expression',request:{operation:'inspect',expression_ref}})).document,document);
 checks.push('Wrong retained chakra identity and stale saved anatomy source refuse before native mutation');
 const withoutEarth=await preparePersonalBodyBindings(read,input);assert.equal(withoutEarth.centres.length,7);assert.equal(withoutEarth.changes.filter(change=>change.change==='subject_bind').length,7);assert.equal(withoutEarth.source_relations.length,12);assert.match(withoutEarth.earth.standing,/none were applied/);
 const earthRef=`${expression_ref}:entity:occurrence-${randomUUID()}`;
 const prepared=await preparePersonalBodyBindings(read,{...input,create_earth:{entity_ref:earthRef}});assert.equal(prepared.source_relations.length,16);
 assert.ok(prepared.centres.every(value=>value.subject_binding.native_owner==='ql-mef'&&value.subject_binding.subject_ref.startsWith('ql:m-coordinate:bimba:')));
 assert.ok(prepared.earth?.relations.length);assert.match(prepared.earth.standing,/Separate Earth occurrence/);
 const request={operation:'edit',expression_ref,expected_revision:document.revision,actor:'agent:nara-native-verification',changes:prepared.changes};
 const bound=(await native({op:'expression',request})).document;
 assert.equal(bound.revision,document.revision+1);assert.deepEqual(bound.selection,document.selection);
 const boundScene=bound.scenes.find(value=>value.scene_ref===scene.scene_ref);assert.equal(boundScene.entity_refs.length,scene.entity_refs.length+1);
 for(const original of scene.presentation.scene.entities)assert.deepEqual(boundScene.presentation.scene.entities.find(value=>value.id===original.id),original);
 for(const [key,relation] of Object.entries(document.relations))assert.deepEqual(bound.relations[key],relation);
 for(const change of prepared.changes.filter(change=>change.change==='relation_bind'))assert.deepEqual(bound.relations[change.binding.binding_ref],change.binding);
 assert.deepEqual(bound.entities[earthRef].subject,prepared.earth.binding);assert.equal(Object.keys(bound.entities).length,8);
 for(const centre of prepared.centres){assert.deepEqual(bound.entities[centre.entity_ref].subject,centre.subject_binding);assert.deepEqual(bound.entities[centre.entity_ref].parameters,document.entities[centre.entity_ref].parameters);}
 checks.push('One actual native CAS binds seven source-qualified subjects, inserts separate Earth through the existing occurrence owner and retains sixteen exact source relations; prior selection, seven-centre material and parameters survive');
 const staleCas=await native({op:'expression',request});assert.equal(staleCas.state,'revision_conflict');assert.equal(staleCas.current_revision,bound.revision);
 const repeated=await preparePersonalBodyBindings(read,{...input,document:bound,earth_entity_ref:earthRef});assert.deepEqual(repeated.changes,[]);
 const createRepeated=await preparePersonalBodyBindings(read,{...input,document:bound,create_earth:{entity_ref:`${expression_ref}:entity:occurrence-${randomUUID()}`}});assert.deepEqual(createRepeated.changes,[]);
 checks.push('Stale native CAS refuses and current exact bindings prepare no redundant edit');
 const conflict=structuredClone(bound),first=prepared.centres[0].entity_ref;conflict.entities[first].subject=structuredClone(prepared.centres[1].subject_binding);
 await assert.rejects(()=>preparePersonalBodyBindings(read,{...input,document:conflict}),/different native identity/);
 assert.deepEqual((await native({op:'expression',request:{operation:'inspect',expression_ref}})).document,bound);
 checks.push('Different existing subject refuses; native bound document is unchanged');
 const next={...config,binding:{...config.binding,expression_ref,expected_revision:identity.source.revision}};
 await writeFile(path.join(output,'native-config.json'),JSON.stringify(next,null,2));
 await writeFile(path.join(output,'receipt.json'),JSON.stringify({schema:'oi.nara-personal-body-native-verification/v1',checks,sources,identity_source:identity.source,calculated_input_revision:calculated.reading.input_revision,source_expression:source.document.expression_ref,prepared,document:bound,limits:['Production preparation and actual native owners; visible Bind my seven centres UI is a separate check','Earth occurrence and native source relations applied; its generic presentation is authored, with no inferred physical/nadi law or action effect']},null,2));
 passed=true;
 process.stdout.write(JSON.stringify({ok:true,expression_ref,checks:checks.length,config:path.join(output,'native-config.json')})+'\n');
}catch(error){const failure=JSON.stringify({error:String(error),expression_ref,checks,sources},null,2);await writeFile(path.join(output,'failure.json'),failure);await writeFile(path.join(output,`failure-${Date.now()}.json`),failure);throw error;}
finally{try{if(created&&!passed)await closeControlledExpression(server,config.bridge,expression_ref,output,'Failed native body replay; source evidence retained');}finally{await server.close();}}
