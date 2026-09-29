#!/usr/bin/env node
/** Two independently initialized native Worlds/Naras, real hosted consent.
 * Inputs are native host/source references. No supplied identity reading,
 * quaternion, fabricated World or model answer is accepted as evidence.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createServer} from 'vite';
import {withdrawNaraProjection,hostedNaraExpressionArgs} from '../../../shared-field/nara-expression-projection.mjs';
import {closeControlledExpression} from './nara-native-cleanup.mjs';
const config=JSON.parse(await readFile(process.argv[2],'utf8'));
const output=path.join(path.dirname(process.argv[2]),`presence-replay-${Date.now()}`);await mkdir(output,{recursive:true});
assert.equal(config.worlds.length,2);assert.notEqual(config.worlds[0].root,config.worlds[1].root);
assert.notEqual(config.worlds[0].aikit_home,config.worlds[1].aikit_home);
for(const w of config.worlds){assert.match(w.bridge,/^http:\/\/127\.0\.0\.1:\d+$/);assert.match(w.binding.expression_ref,/^expression:controlled-presence-/);assert.ok(w.root.includes('/T/'));}
const observations=[],checks=[],owned=[],publications=[];let server;
async function call(w,request,bridge=w.bridge){
 const response=await fetch(bridge+'/op',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(120000)});
 const result=await response.json();observations.push({world:w.label,op:request.op,operation:request.request?.operation??request.request?.kind,error:result.error??null});
 if(result.error)throw Error(result.error);assert.ok(result.outcome);if(result.outcome.data?.state==='unavailable')throw Error(result.outcome.data.detail??'Native owner unavailable');return result.outcome.data;
}
const safeText=(value,privateValues)=>{const encoded=JSON.stringify(value);for(const text of privateValues)assert.equal(encoded.includes(text),false,`Private value crossed publication: ${text}`);
 for(const key of ['q_identity','q_natal','q_composed','raw_efwa','natal_composition','personal_current','bioquaternion','Control/self/nara','agent-session/'])assert.equal(encoded.includes(key),false,`Private field crossed publication: ${key}`);};
try {
 server=await createServer({configFile:false,root:process.cwd(),cacheDir:path.join(output,'vite-cache'),server:{middlewareMode:true,hmr:false}});
 const {ensureNativeCoordinateProfile}=await server.ssrLoadModule('/src/nara/coordinateExpression.ts');
 const {nativePresence}=await server.ssrLoadModule('/src/nara/nativePresence.ts');
 const suffix=randomUUID(),states=[];
 for(const w of config.worlds){
  const identity=await call(w,{op:'nara_identity',request:{operation:'open',source_ref:w.binding.source_ref}});
  assert.equal(identity.reading.person_ref,w.binding.person_ref);assert.equal(identity.reading.nara_ref,w.binding.nara_ref);
  const actual=await call(w,{op:'expression',request:{operation:'inspect',expression_ref:w.binding.expression_ref}},w.source_bridge);
  await call(w,{op:'expression',request:{operation:'open',document:actual.document,actor:'agent:ta5-native-replay'}});if(w.source_bridge!==w.bridge)owned.push(w);
  await ensureNativeCoordinateProfile(request=>call(w,{op:'expression',request}),request=>call(w,{op:'nara_coordinate',request}),actual.document);
  const binding={...w.binding,operation:'context',expected_revision:identity.source.revision};
  const session=await call(w,{op:'nara_dialogue',project:'',request:{...binding,operation:'lookup'}});
  assert.equal(session.provisioning?.agent_session,w.agent_session,'Use the actual retained native binding; no substitute body');
  const context=await call(w,{op:'nara_dialogue',project:'',request:binding});
  const calculation=await call(w,{op:'nara_identity',request:{operation:'calculate',profile:identity.reading.profile}});
  assert.ok(calculation.reading.natal.sky.snapshot_ref);assert.equal(calculation.reading.natal.provider.network,'disabled');
  const transport=await call(w,{op:'shared_field',request:{kind:'identity'}});
  const hosted=await call(w,{op:'shared_field',request:{kind:'snapshot'}});
  const entry=hosted.entries.find(row=>row.ref===actual.document.expression_ref);
  const prior=entry?hosted.projections.find(row=>row.projection_ref===entry.meta?.projection_ref):null;
  if(prior)assert.equal(prior.state,'withdrawn','Recover or withdraw the actual current publication before this bounded replay');
  const publisher=prior?hosted.participants.find(row=>row.participant_ref===prior.publisher_participant_ref):null;
  const recipient=prior?hosted.participants.find(row=>row.participant_ref===prior.audience.refs[0]):null;
  const label=w.label,field_ref=`oi:field:ta5-native:${label}:${suffix}`,participant_ref=`participant:ta5-native:${label}:${suffix}`;
  states.push({w,binding,identity,calculation,context,document:actual.document,transport,entry,prior,publisher,recipient,field_ref:publisher?.field_ref??field_ref,participant_ref:publisher?.participant_ref??participant_ref,identity_ref:publisher?.identity.ref??`human:ta5-native:${label}:${suffix}`});
 }
 assert.notEqual(states[0].transport.transport_identity,states[1].transport.transport_identity);
 assert.notEqual(states[0].calculation.reading.natal.sky.snapshot_ref,states[1].calculation.reading.natal.sky.snapshot_ref);
 assert.notDeepEqual(states[0].calculation.reading.natal_composition.q_natal,states[1].calculation.reading.natal_composition.q_natal);
 assert.equal(states[0].context.context.coordinate_ref,states[1].context.context.coordinate_ref);
 checks.push('Two native Central roots, saved identity sources, retained Nara sessions and transport identities remain independent at one actual coordinate');
 checks.push('Both actual native natal calculations differ; no supplied quaternion enters shared presence');
 for(let i=0;i<states.length;i++){
  const s=states[i],peer=states[1-i],at=new Date();
  const publication={field_ref:s.field_ref,world_ref:s.entry?.world_ref??`world:ta5-native:${s.w.label}:${suffix}`,
   projection_ref:s.prior?.projection_ref??`projection:ta5-native:${s.w.label}:${suffix}`,presentation_ref:s.entry?.meta.presentation_ref??`presentation:ta5-native:${s.w.label}:${suffix}`,projection_revision:(s.prior?.projection_revision??0)+1,
   publisher_identity_ref:s.identity_ref,publisher_participant_ref:s.participant_ref,target_ref:s.recipient?.participant_ref??`participant:ta5-peer:${peer.w.label}:${suffix}:${s.w.label}`,target_identity_ref:s.recipient?.identity.ref??peer.identity_ref,
   consent_ref:`consent:ta5-native:${s.w.label}:${suffix}:1`,granted_at:at.toISOString(),granted_at_unix_ms:at.getTime()};
  const request={operation:'prepare',binding:s.binding,expected_expression_revision:s.document.revision,publication};
  const invoke=r=>nativePresence({kind:'bridge',url:s.w.bridge},'',r);
  await assert.rejects(()=>call(s.w,{op:'shared_field',request:{kind:'preview_nara',input:{}}}),/native|Native|admission/);
  await assert.rejects(()=>invoke({...request,expected_expression_revision:s.document.revision+1}),/revision/);
  await assert.rejects(()=>invoke({...request,publication:{...publication,granted_at_unix_ms:Date.now()+3600000}}),/consent|grant/);
  await assert.rejects(()=>call(s.w,{op:'nara_presence',project:'',request:{...request,document:s.document}}),/unknown field|unreadable/);
  await assert.rejects(()=>call(peer.w,{op:'nara_identity',request:{operation:'open',source_ref:s.identity.source.source_ref}}),/source|Source|found|exist/);
  const preview=await invoke(request);assert.equal(preview.consent_reading.permitted,true);
  const privateValues=states.flatMap(x=>[x.identity.source.source_ref,x.identity.reading.person_ref,x.identity.reading.nara_ref,x.identity.reading.profile.name]);
  const args=hostedNaraExpressionArgs(preview.bundle);safeText(args,privateValues);
  assert.equal(Object.keys(preview.bundle.composition.entities).length,8);
  assert.ok(Object.values(preview.bundle.composition.entities).every(e=>/^ql:m-coordinate:bimba:M2-5-0\/1-[0-7]$/.test(e.subject.subject_ref)));
  const published=await invoke({...request,operation:'publish'});publications.push({s,request,published});
  assert.deepEqual(published.bundle,preview.bundle,'Published outward bytes must match the native prepared preview');
  const target=JSON.parse(args.putParticipants[0].contractJson);
  await call(s.w,{op:'shared_field',request:{kind:'participant',participant:target,target_identity:peer.transport.transport_identity,role:'observer',contactable:true}});
  await assert.rejects(()=>invoke({...request,operation:'publish'}),/hosted revision|recover|withdraw/);
  s.published=published;s.request=request;s.privateValues=privateValues;
 }
 checks.push('Native scope/source/CAS guards and supplied-document refusal operate before publication; preview and actual hosted projection match');
 for(const s of states){
  const snapshot=await call(s.w,{op:'shared_field',request:{kind:'snapshot'}});
  for(const other of states){const hosted=snapshot.projections.filter(p=>p.projection_ref===other.request.publication.projection_ref);assert.equal(hosted.length,1);safeText(hosted,s.privateValues);}
  const current=await call(s.w,{op:'nara_dialogue',project:'',request:{...s.binding,operation:'lookup'}});assert.equal(current.provisioning.agent_session,s.w.agent_session);
 }
 checks.push('Each actual transport reads both consented projections at common native body coordinates; identities and private natal material are absent');
 for(const s of states){
  const lifecycle=withdrawNaraProjection(s.published.bundle,s.published.bundle.nara_presence.consent,{withdrawn_at:new Date().toISOString(),withdrawal_ref:`withdrawal:ta5-native:${s.w.label}:${suffix}`});
  await call(s.w,{op:'shared_field',request:{kind:'projection',field_ref:s.field_ref,projection:lifecycle.projection}});
  await assert.rejects(()=>nativePresence({kind:'bridge',url:s.w.bridge},'',{...s.request,operation:'publish'}),/hosted revision|recover|withdraw/);
  s.withdrawn=lifecycle;
 }
 for(const s of states){const snapshot=await call(s.w,{op:'shared_field',request:{kind:'snapshot'}});for(const other of states){
  const latest=snapshot.projections.filter(p=>p.projection_ref===other.request.publication.projection_ref).sort((a,b)=>b.projection_revision-a.projection_revision)[0];assert.equal(latest.state,'withdrawn');assert.equal(latest.relation_hints?.some(r=>r.kind==='consented-presence')??false,false);
 }}
 checks.push('Native withdrawal advances the hosted revision and removes current presence; old consent cannot silently republish a stale revision');
 for(const s of states){
  await assert.rejects(()=>nativePresence({kind:'bridge',url:s.w.bridge},'',{...s.request,operation:'publish',publication:{...s.request.publication,projection_revision:s.request.publication.projection_revision+2}}),/fresh consent|withdrawal/);
  const at=new Date(),request={...s.request,operation:'publish',publication:{...s.request.publication,
   projection_revision:s.request.publication.projection_revision+2,consent_ref:s.request.publication.consent_ref+':reentry',granted_at:at.toISOString(),granted_at_unix_ms:at.getTime()}};
  const reentered=await nativePresence({kind:'bridge',url:s.w.bridge},'',request);
  s.withdrawn=null;publications.push({s,request,published:reentered});
  assert.equal(reentered.bundle.projection.projection_ref,s.published.bundle.projection.projection_ref);
  assert.equal(reentered.bundle.projection.projection_revision,s.request.publication.projection_revision+2);
  assert.notEqual(reentered.bundle.nara_presence.consent.consent_ref,s.published.bundle.nara_presence.consent.consent_ref);
  safeText(hostedNaraExpressionArgs(reentered.bundle),s.privateValues);
  const lifecycle=withdrawNaraProjection(reentered.bundle,reentered.bundle.nara_presence.consent,{withdrawn_at:new Date().toISOString(),withdrawal_ref:`withdrawal:ta5-reentry:${s.w.label}:${suffix}`});
  await call(s.w,{op:'shared_field',request:{kind:'projection',field_ref:s.field_ref,projection:lifecycle.projection}});s.withdrawn=lifecycle;
  const native=await call(s.w,{op:'nara_dialogue',project:'',request:{...s.binding,operation:'lookup'}});
  assert.equal(native.provisioning.agent_session,s.w.agent_session);
 }
 checks.push('Fresh explicit consent re-enters the same hosted projection at the next valid revision; final withdrawal advances again and each canonical Nara remains the same session');
 await writeFile(path.join(output,'receipt.json'),JSON.stringify({status:'passed',checks,observations,native_cut:config.native_cut,
  worlds:states.map(s=>({root:s.w.root,aikit_home:s.w.aikit_home,source:s.identity.source,person_ref:s.binding.person_ref,nara_ref:s.binding.nara_ref,
   agent_session:s.w.agent_session,transport_identity:s.transport.transport_identity,coordinate_ref:s.context.context.coordinate_ref,
   natal_snapshot:s.calculation.reading.natal.sky.snapshot_ref,projection:s.published.publication,withdrawn:s.withdrawn.projection})),
  limits:['Two independently owned Worlds on one Mac; not a two-machine installed application replay.','No generated dialogue, private numerical field, or hidden model state is published.']},null,2));
 console.log(JSON.stringify({status:'passed',checks,receipt:path.join(output,'receipt.json')},null,2));
}catch(error){await writeFile(path.join(output,'failure.json'),JSON.stringify({error:String(error),observations},null,2));throw error;}
finally{
 // A failed observation must not leave this test's hosted presence active.
 const failures=[],seen=new Set();
 for(const row of [...publications].reverse()){const ref=row.published.bundle.projection.projection_ref;if(seen.has(ref))continue;seen.add(ref);try{if(!row.s.withdrawn){const lifecycle=withdrawNaraProjection(row.published.bundle,row.published.bundle.nara_presence.consent,{withdrawn_at:new Date().toISOString(),withdrawal_ref:`withdrawal:ta5-cleanup:${randomUUID()}`});await call(row.s.w,{op:'shared_field',request:{kind:'projection',field_ref:row.s.field_ref,projection:lifecycle.projection}});}}catch(error){failures.push(String(error));await writeFile(path.join(output,`withdraw-cleanup-${row.s.w.label}.json`),JSON.stringify({error:String(error)}));}}
 if(server){for(const w of owned){try{await closeControlledExpression(server,w.bridge,w.binding.expression_ref,output,'TA5 two-world native replay');if(w.source_fork&&w.source_bridge!==w.bridge)await closeControlledExpression(server,w.source_bridge,w.binding.expression_ref,output,'TA5 native source fork cleanup');}catch(error){failures.push(String(error));await writeFile(path.join(output,`close-${w.label}-failure.json`),JSON.stringify({error:String(error)}));}}await server.close();}
 await writeFile(path.join(output,'cleanup.json'),JSON.stringify({status:failures.length?'failed':'passed',failures},null,2));
 if(failures.length)throw Error('Native replay cleanup failed: '+failures.join('; '));
}
