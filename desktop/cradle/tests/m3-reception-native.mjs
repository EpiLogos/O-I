#!/usr/bin/env node
/** Actual saved identity, adopted source profile, dated provider and native M3
 * command reception. Explicit symbolic activity policy; no legacy closure claim.
 * node tests/nara-m3-native.mjs /absolute/config.json */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {createServer} from 'vite';
const config=JSON.parse(await readFile(process.argv[2],'utf8'));
assert.match(config.bridge,/^http:\/\/127\.0\.0\.1:\d+$/);
assert.match(config.binding.person_ref,/^controlled:/);
assert.ok(config.output.includes('/T/'));assert.ok(config.file_path.startsWith('Work/controlled/'));
await mkdir(config.output,{recursive:true});
const native=async value=>{
 const response=await fetch(`${config.bridge}/op`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value),signal:AbortSignal.timeout(120000)});
 const result=await response.json();if(result.error)throw Error(result.error);return result.outcome.data;
};
const server=await createServer({configFile:false,root:process.cwd(),cacheDir:path.join(config.output,'vite-cache'),server:{middlewareMode:true,hmr:false,ws:false}});
let opened=false,fork=null;const checks=[];
try{
 const {hostedCompositionFile}=await server.ssrLoadModule('/src/expressions/hostedComposition.ts');
 const {ensureNativeCoordinateProfile,validateCoordinateExpression}=await server.ssrLoadModule('/src/nara/coordinateExpression.ts');
 const listed=await native({op:'expression',request:{operation:'list'}});
 opened=!listed.expressions.some(row=>row.expression_ref===config.binding.expression_ref);
 const source=await hostedCompositionFile({kind:'bridge',url:config.bridge},{operation:'open',path:config.file_path});
 await ensureNativeCoordinateProfile(request=>native({op:'expression',request}),async request=>validateCoordinateExpression(await native({op:'nara_coordinate',request})),source.document);
 const expression_ref=`expression:controlled-m3-${randomUUID()}`;
 fork=await native({op:'expression',request:{operation:'fork',expression_ref:source.document.expression_ref,expected_revision:source.document.revision,new_expression_ref:expression_ref,actor:'agent:nara-m3-verification'}});
 const identity=await native({op:'nara_identity',request:{operation:'open',source_ref:config.binding.source_ref}});
 const binding={...config.binding,operation:'context',role:'nara',expression_ref,expected_revision:identity.source.revision};
 const op=request=>native({op:'m3_reception',project:config.project,request:{...request,binding}});
 const absent=await op({operation:'read'});assert.equal(absent.status,'absent');
 const selections={clock_steps:359,address:0,pose:0,aperture:0,matrix_axis:0,rna:false};
 await assert.rejects(()=>op({operation:'open',selections}),/Pin the actual personal current/);
 const sky_request={schema:'ql.sky-request/v1',epoch:'2026-09-27T12:00:00Z',timezone:'UTC',mode:'historical',perspective:'Apparent Geocentric',zodiac:'Tropical',ayanamsha:null,observer:null,max_age_seconds:300,backend_policy:'allow-moshier'};
 const pinned=await native({op:'nara_current',project:config.project,request:{operation:'pin',binding,sky_request}});
 const first=await op({operation:'open',selections,activity_policy:'historical-personal-frame-sprite-v1'});
 assert.equal(first.state.subject_ref,binding.person_ref);assert.equal(first.state.identity.event_ref,pinned.context.event_ref);
 assert.equal(first.state.identity.profile_generation,0);assert.equal(first.state.clock.degree720,359);
 assert.equal(first.state.bases.initial.source_ref,pinned.context.reading_ref);
 assert.equal(first.activity_admitted,false);assert.equal(first.private,true);assert.equal(first.public_export,false);
 assert.deepEqual(await op({operation:'read'}),first);
 checks.push('Native open derives saved person, actual event and source provenance; reads do not advance');
 await assert.rejects(()=>op({operation:'open',selections}),/already open/);
 await assert.rejects(()=>op({operation:'apply',expected_generation:1,operations:[{operation:'select-form',address:56}]}),/Stale/);
 await assert.rejects(()=>op({operation:'apply',expected_generation:0,operations:[{operation:'select-form',address:64}]}),/outside/);
 assert.deepEqual(await op({operation:'read'}),first);
 checks.push('Duplicate open, stale command and invalid native form leave the real state unchanged');
 const changed=await op({operation:'apply',expected_generation:0,operations:[{operation:'select-form',address:56},{operation:'advance-clock',steps:1}]});
 assert.equal(changed.state.form.address,56);assert.equal(changed.state.clock.degree720,360);assert.equal(changed.state.identity.profile_generation,1);
 assert.deepEqual(changed.receipts[0].before,first.state);assert.deepEqual(changed.receipts[0].after,changed.state);
 assert.equal(changed.receipts[0].status,'applied');assert.equal(changed.receipts[0].command.subject_ref,binding.person_ref);
 assert.deepEqual(changed.state.bases,first.state.bases);
 checks.push('An actual host command atomically adopts the complete native form, clock and receipt');
 assert.equal(changed.activity_admitted,true);assert.equal(changed.activity.status,'available');
 assert.equal(changed.activity.turn_count,1);assert.equal(changed.activity.subject_ref,binding.person_ref);
 assert.equal(changed.activity.event_ref,pinned.context.event_ref);
 const twice=await op({operation:'apply',expected_generation:1,operations:[{operation:'select-form',address:1}]});
 assert.equal(twice.activity.turn_count,2);assert.notDeepEqual(twice.activity.q_activity,changed.activity.q_activity);
 assert.notDeepEqual(twice.personal_current.reading.q_composed,changed.personal_current.reading.q_composed);
 assert.ok(twice.personal_current.reading.q_composed,'Selected real native identity baseline required');
 for(const result of [changed,twice])for(const field of ['identity','transit','q_identity','q_identity_transit','snapshot_ref'])
   assert.deepEqual(result.personal_current.reading[field],pinned.reading[field]);
 assert.deepEqual((await op({operation:'read'})).state,twice.state);
 checks.push('Two actual ordered activities change native composed reading while preserving identity, natal and dated sky');
 const scene=fork.document.scenes.find(scene=>scene.entity_refs.some(ref=>ref!==fork.document.selection.entity_ref));
 assert.ok(scene,'Actual Expression must expose a second selectable entity');
 const entity_ref=scene.entity_refs.find(ref=>ref!==fork.document.selection.entity_ref);
 const focused=await native({op:'expression',request:{operation:'edit',expression_ref,expected_revision:fork.document.revision,actor:'agent:nara-m3-verification',changes:[{change:'focus',scene_ref:scene.scene_ref,entity_ref}]}});
 const focusedM3=await op({operation:'read'});
 assert.deepEqual(focusedM3.state,twice.state);assert.deepEqual(focusedM3.activity,twice.activity);
 const restored=await native({op:'expression',request:{operation:'edit',expression_ref,expected_revision:focused.document.revision,actor:'agent:nara-m3-verification',changes:[{change:'focus',scene_ref:fork.document.selection.scene_ref,entity_ref:fork.document.selection.entity_ref??null}]}});
 assert.deepEqual((await op({operation:'read'})).state,twice.state);
 checks.push('Actual reversible native focus preserves the same M3 event, activity and generation');


 await assert.rejects(()=>native({op:'m3_reception',project:config.project,request:{operation:'read',binding:{...binding,expected_revision:'stale-source'}}}),/changed|revision|match/i);
 const repinned=await native({op:'nara_current',project:config.project,request:{operation:'pin',binding,sky_request:{...sky_request,epoch:'2026-12-27T12:00:00Z'}}});
 assert.notEqual(repinned.context.event_ref,pinned.context.event_ref);
 assert.equal((await op({operation:'read'})).status,'absent');
 await assert.rejects(()=>op({operation:'apply',expected_generation:1,operations:[{operation:'advance-clock',steps:1}]}),/No current M3/);
 const unselected=await op({operation:'open',selections});
 const previous=await op({operation:'apply',expected_generation:0,operations:[{operation:'select-form',address:56}]});
 assert.equal(previous.activity_admitted,false);
 await assert.rejects(()=>op({operation:'select_activity_policy',expected_generation:1,expected_revision:'stale',activity_policy:'historical-personal-frame-sprite-v1'}),/Stale/);
 const enabled=await op({operation:'select_activity_policy',expected_generation:1,expected_revision:previous.revision,activity_policy:'historical-personal-frame-sprite-v1'});
 assert.deepEqual(enabled.state,previous.state);assert.deepEqual(enabled.receipts,previous.receipts);
 assert.equal(enabled.activity.turn_count,0);assert.equal(enabled.activity.start_generation,1);
 await assert.rejects(()=>op({operation:'select_activity_policy',expected_generation:1,expected_revision:enabled.revision,activity_policy:'historical-personal-frame-sprite-v1'}),/already selected/);
 const subsequent=await op({operation:'apply',expected_generation:1,operations:[{operation:'select-form',address:1}]});
 assert.equal(subsequent.activity.turn_count,1);assert.equal(subsequent.activity.packets[0].before_generation,1);
 checks.push('Explicit policy selection preserves an existing form and admits only subsequent successful commands');
 const renamed=await native({op:'expression',request:{operation:'edit',expression_ref,expected_revision:restored.document.revision,actor:'agent:nara-m3-verification',changes:[{change:'rename',title:restored.document.title+' controlled structural change'}]}});
 assert.equal((await op({operation:'read'})).status,'absent');
 const restoredStructure=await native({op:'expression',request:{operation:'edit',expression_ref,expected_revision:renamed.document.revision,actor:'agent:nara-m3-verification',changes:[{change:'rename',title:restored.document.title}]}});
 assert.equal((await op({operation:'read'})).status,'absent');
 checks.push('A structural edit invalidates M3 permanently even when the prior structure is restored');

 assert.deepEqual(await native({op:'nara_identity',request:{operation:'open',source_ref:binding.source_ref}}),identity);
 assert.deepEqual((await native({op:'expression',request:{operation:'inspect',expression_ref}})).document,restoredStructure.document);
 checks.push('Changed native event invalidates M3; saved identity remains unchanged and edits stay in the owned fork');
 const sources=Object.fromEntries(await Promise.all(['kernel/src/m3_reception.rs','kernel/src/nara_identity.rs','kernel/src/lib.rs','tests/m3-reception-native.mjs'].map(async file=>[file,createHash('sha256').update(await readFile(file)).digest('hex')])));
 await writeFile(path.join(config.output,'receipt.json'),JSON.stringify({schema:'oi.m3-reception-native-verification/v1',checks,first,changed,twice,enabled,subsequent,pinned_event:pinned.context,changed_event:repinned.context,sources,limits:['Explicit selected symbolic activity policy; no historical contemplation closure, physical material map or human Recognition inferred']},null,2));
 console.log(JSON.stringify({ok:true,checks:checks.length,output:config.output}));
}finally{
 if(fork)await native({op:'expression',request:{operation:'close',expression_ref:fork.document.expression_ref,actor:'agent:nara-m3-verification'}});
 if(opened)await native({op:'expression',request:{operation:'close',expression_ref:config.binding.expression_ref,actor:'agent:nara-m3-verification'}});
 await server.close();
}
